import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { AppRuntime } from "../../app/contracts.js";
import type { McpToolHandlers } from "../mcp/index.js";
import { runCli } from "./main.js";

async function writeConfigFile(): Promise<{
  readonly configPath: string;
  readonly notesPath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-cli-"));
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

async function runCliWithWrites(args: string[], options?: Parameters<typeof runCli>[2]): Promise<{
  readonly exitCode: number;
  readonly writes: readonly string[];
}> {
  const writes: string[] = [];
  const exitCode = await runCli(args, {
    write: (value) => writes.push(value)
  }, options);

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
      message: "Usage: mindweave health | status --config <path> | start --config <path> | scan --config <path> | watch --config <path> | query --config <path> <query> | mcp --config <path>"
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
        enabled: false
      },
      unavailableCapabilities: []
    });
  });

  it("routes scan through runtime and prints a structured success payload", async () => {
    const { configPath } = await writeConfigFile();

    const result = await runCliWithWrites(["scan", "--config", configPath]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.writes[0] ?? "")).toEqual({
      status: "scanned"
    });
  });

  it("routes query through runtime and returns structured provider errors", async () => {
    const { configPath } = await writeConfigFile();

    const result = await runCliWithWrites(["query", "--config", configPath, "hello"]);
    const payload = JSON.parse(result.writes[0] ?? "");

    expect(result.exitCode).toBe(1);
    expect(payload.code).toBe("CLI_UNKNOWN_ERROR");
    expect(payload.message).toBe("Missing API key environment variable: OPENAI_API_KEY");
  });

  it("routes mcp through runtime handlers without scanning or starting watchers", async () => {
    const handlers = createNoopMcpToolHandlers();
    const runtime = new CapturingRuntime(handlers);
    const servedHandlers: McpToolHandlers[] = [];

    const result = await runCliWithWrites(["mcp", "--config", "mind-weave.jsonc"], {
      createRuntime: async (configPath) => {
        expect(configPath).toBe("mind-weave.jsonc");
        return runtime;
      },
      serveMcp: async (input) => {
        servedHandlers.push(input.handlers);
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([]);
    expect(servedHandlers).toEqual([handlers]);
    expect(runtime.scanCalls).toBe(0);
    expect(runtime.startCalls).toBe(0);
    expect(runtime.mcpHandlerCalls).toBe(1);
  });

  it("routes watch to runtime start without serving MCP", async () => {
    const runtime = new CapturingRuntime(createNoopMcpToolHandlers());
    const servedHandlers: McpToolHandlers[] = [];

    const result = await runCliWithWrites(["watch", "--config", "mind-weave.jsonc"], {
      createRuntime: async () => runtime,
      serveMcp: async (input) => {
        servedHandlers.push(input.handlers);
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([]);
    expect(runtime.startCalls).toBe(1);
    expect(runtime.scanCalls).toBe(0);
    expect(runtime.mcpHandlerCalls).toBe(0);
    expect(servedHandlers).toEqual([]);
  });

  it("routes start to runtime start and then MCP serving", async () => {
    const handlers = createNoopMcpToolHandlers();
    const runtime = new CapturingRuntime(handlers);
    const calls = runtime.calls;

    const result = await runCliWithWrites(["start", "--config", "mind-weave.jsonc"], {
      createRuntime: async () => runtime,
      serveMcp: async (input) => {
        expect(input.handlers).toBe(handlers);
        calls.push("serveMcp");
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.writes).toEqual([]);
    expect(runtime.startCalls).toBe(1);
    expect(runtime.scanCalls).toBe(0);
    expect(runtime.mcpHandlerCalls).toBe(1);
    expect(calls).toEqual(["runtime.start", "serveMcp"]);
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

class CapturingRuntime implements AppRuntime {
  scanCalls = 0;
  startCalls = 0;
  mcpHandlerCalls = 0;

  constructor(private readonly handlers: McpToolHandlers) {}

  getHealth() {
    return {
      name: "mind-weave-core" as const,
      status: "ok" as const
    };
  }

  getStatus() {
    return Promise.resolve({
      name: "mind-weave-core" as const,
      status: "configured" as const,
      sourceCount: 0,
      sources: [],
      embedding: {
        provider: "openai-compatible",
        model: "text-embedding-3-small"
      },
      storage: {
        type: "sqlite",
        path: "mind-weave.sqlite"
      },
      observability: {
        logPath: "mindweave.log"
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
  }

  async start(): Promise<void> {
    this.startCalls += 1;
    this.calls.push("runtime.start");
  }

  async scan(): Promise<void> {
    this.scanCalls += 1;
  }

  async query() {
    return [];
  }

  getMcpToolHandlers(): McpToolHandlers {
    this.mcpHandlerCalls += 1;
    return this.handlers;
  }

  async stop(): Promise<void> {}

  readonly calls: string[] = [];
}

function createNoopMcpToolHandlers(): McpToolHandlers {
  return {
    async searchKnowledge() {
      return {
        results: []
      };
    },
    async listSources() {
      return {
        sources: []
      };
    }
  };
}
