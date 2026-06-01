import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "./main.js";

async function writeConfigFile(): Promise<{
  readonly configPath: string;
  readonly notesPath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-cli-"));
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
    },
    "mcp": {
      "enabled": false
    }
  }`, "utf8");

  return {
    configPath,
    notesPath
  };
}

async function runCliWithWrites(args: string[]): Promise<{
  readonly exitCode: number;
  readonly writes: readonly string[];
}> {
  const writes: string[] = [];
  const exitCode = await runCli(args, {
    write: (value) => writes.push(value)
  });

  return {
    exitCode,
    writes
  };
}

describe("runCli", () => {
  it("prints runtime health as JSON", async () => {
    const result = await runCliWithWrites(["health"]);

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([
      "{\"name\":\"mind-weave-core\",\"status\":\"ok\"}\n"
    ]);
  });

  it("prints structured usage errors for unknown commands", async () => {
    const result = await runCliWithWrites(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.writes[0] ?? "")).toEqual({
      code: "CLI_USAGE_ERROR",
      message: "Usage: mindweave health | status --config <path> | start --config <path> | scan --config <path> | query --config <path> <query>"
    });
  });

  it("prints structured usage errors when config is missing", async () => {
    const result = await runCliWithWrites(["status"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.writes[0] ?? "")).toEqual({
      code: "CLI_USAGE_ERROR",
      message: "Missing required --config <path>."
    });
  });

  it("routes status through runtime using a real JSONC config file", async () => {
    const { configPath, notesPath } = await writeConfigFile();

    const result = await runCliWithWrites(["status", "--config", configPath]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.writes[0] ?? "")).toEqual({
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
        model: "text-embedding-3-small"
      },
      storage: {
        type: "sqlite"
      },
      mcp: {
        enabled: false
      },
      unavailableCapabilities: ["start", "scan", "query"]
    });
  });

  it("routes unavailable commands through runtime and returns structured errors", async () => {
    const { configPath } = await writeConfigFile();

    for (const args of [
      ["start", "--config", configPath],
      ["scan", "--config", configPath],
      ["query", "--config", configPath, "hello"]
    ]) {
      const result = await runCliWithWrites(args);
      const payload = JSON.parse(result.writes[0] ?? "");

      expect(result.exitCode).toBe(1);
      expect(payload.code).toBe("APP_CAPABILITY_NOT_AVAILABLE");
      expect(["start", "scan", "query"]).toContain(payload.capability);
      expect(payload.issues).toHaveLength(1);
    }
  });

  it("keeps the CLI adapter from importing lower-level core modules directly", () => {
    const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../../sources/");
    expect(source).not.toContain("../../processors/");
    expect(source).not.toContain("../../embeddings/");
    expect(source).not.toContain("../../storage/");
    expect(source).not.toContain("../../query/");
    expect(source).not.toContain("../../indexing/");
    expect(source).not.toContain("../../config/");
  });
});
