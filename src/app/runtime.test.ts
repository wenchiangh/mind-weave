import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { Logger } from "../observability/index.js";
import { isAppError } from "./errors.js";
import {
  createRuntimeFromConfigFile,
  getRuntimeHealth
} from "./runtime.js";

async function writeConfigFile(): Promise<{
  readonly configPath: string;
  readonly notesPath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-runtime-"));
  const configPath = path.join(directory, "mind-weave.jsonc");
  const notesPath = path.join(directory, "notes");
  await mkdir(notesPath, { recursive: true });

  await writeFile(configPath, `{
    "sources": [
      {
        "type": "local-fs",
        "id": "notes",
        "name": "Notes",
        "rootPath": "./notes",
      },
    ],
    "embedding": {
      "provider": "openai-compatible",
      "model": "text-embedding-3-small",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "storage": {
      "type": "sqlite",
      "path": "./mind-weave.sqlite"
    }
  }`, "utf8");

  return {
    configPath,
    notesPath
  };
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

describe("getRuntimeHealth", () => {
  it("returns a stable runtime health payload", () => {
    expect(getRuntimeHealth()).toEqual({
      name: "mind-weave-core",
      status: "ok"
    });
  });
});

describe("createRuntimeFromConfigFile", () => {
  it("creates runtime status from a real JSONC config file", async () => {
    const { configPath, notesPath } = await writeConfigFile();

    const runtime = await createRuntimeFromConfigFile(configPath);

    await expect(runtime.getStatus()).resolves.toEqual({
      name: "mind-weave-core",
      status: "configured",
      sourceCount: 1,
      sources: [
        {
          id: "notes",
          type: "local-fs",
          name: "Notes",
          rootUri: pathToFileURL(notesPath).href,
          status: "active"
        }
      ],
      embedding: {
        provider: "openai-compatible",
        model: "text-embedding-3-small",
        dimensions: undefined
      },
      storage: {
        type: "sqlite",
        path: path.join(path.dirname(configPath), "mind-weave.sqlite")
      },
      observability: {
        logPath: path.join(path.dirname(configPath), "logs", "mindweave.log")
      },
      index: {
        documents: {
          indexed: 0,
          stale: 0,
          failed: 0,
          deleted: 0
        }
      },
      mcp: {
        enabled: true
      },
      unavailableCapabilities: []
    });
  });

  it("can scan an empty configured source", async () => {
    const { configPath } = await writeConfigFile();
    const runtime = await createRuntimeFromConfigFile(configPath);

    await expect(runtime.scan()).resolves.toBeUndefined();
    await runtime.stop();
  });

  it("logs scan start and finish events", async () => {
    const { configPath } = await writeConfigFile();
    const logger = new CapturingLogger();
    const runtime = await createRuntimeFromConfigFile(configPath, { logger });

    await runtime.scan();

    expect(logger.events).toMatchObject([
      {
        level: "info",
        event: "scan.started",
        sourceCount: 1
      },
      {
        level: "info",
        event: "scan.finished",
        sourceCount: 1
      }
    ]);
    await runtime.stop();
  });

  it("surfaces embedding configuration errors for query", async () => {
    const { configPath } = await writeConfigFile();
    const runtime = await createRuntimeFromConfigFile(configPath);

    const error = await captureError(async () => runtime.query("hello"));

    expect(isAppError(error)).toBe(false);
    expect(error).toMatchObject({
      name: "EmbeddingProviderError",
      message: "Missing API key environment variable: OPENAI_API_KEY"
    });
    await runtime.stop();
  });

  it("logs query failures before surfacing them", async () => {
    const { configPath } = await writeConfigFile();
    const logger = new CapturingLogger();
    const runtime = await createRuntimeFromConfigFile(configPath, { logger });

    const error = await captureError(async () => runtime.query("hello"));

    expect(error).toMatchObject({
      name: "EmbeddingProviderError"
    });
    expect(logger.events).toMatchObject([
      {
        level: "error",
        event: "query.failed",
        error: "Missing API key environment variable: OPENAI_API_KEY"
      }
    ]);
    await runtime.stop();
  });

  it("can stop before downstream services exist", async () => {
    const { configPath } = await writeConfigFile();
    const runtime = await createRuntimeFromConfigFile(configPath);

    await expect(runtime.stop()).resolves.toBeUndefined();
  });
});

class CapturingLogger implements Logger {
  readonly events: Array<{
    readonly level: "info" | "error";
    readonly event: string;
    readonly [key: string]: unknown;
  }> = [];

  async info(event: string, metadata = {}): Promise<void> {
    this.events.push({
      level: "info",
      event,
      ...metadata
    });
  }

  async error(event: string, metadata = {}): Promise<void> {
    this.events.push({
      level: "error",
      event,
      ...metadata
    });
  }
}
