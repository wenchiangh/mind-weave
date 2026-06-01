import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
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

    expect(runtime.getStatus()).toEqual({
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
        type: "sqlite"
      },
      mcp: {
        enabled: true
      },
      unavailableCapabilities: ["start", "scan", "query"]
    });
  });

  it("returns structured capability errors for unavailable runtime capabilities", async () => {
    const { configPath } = await writeConfigFile();
    const runtime = await createRuntimeFromConfigFile(configPath);

    for (const capability of ["start", "scan", "query"] as const) {
      const error = await captureError(async () => {
        if (capability === "query") {
          await runtime.query("hello");
          return;
        }

        await runtime[capability]();
      });

      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) {
        expect(error.code).toBe("APP_CAPABILITY_NOT_AVAILABLE");
        expect(error.capability).toBe(capability);
      }
    }
  });

  it("can stop before downstream services exist", async () => {
    const { configPath } = await writeConfigFile();
    const runtime = await createRuntimeFromConfigFile(configPath);

    await expect(runtime.stop()).resolves.toBeUndefined();
  });
});
