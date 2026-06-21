import { describe, expect, it } from "vitest";
import type {
  AppRuntime,
  RuntimeWatchStatus,
  RuntimeScanOptions
} from "../../app/contracts.js";
import type { McpToolHandlers } from "../mcp/index.js";
import { createShellBridgeHandler } from "./handler.js";

describe("shell bridge handler", () => {
  it("maps read operations to AppRuntime without transport assumptions", async () => {
    const runtime = new CapturingRuntime();
    const bridge = createShellBridgeHandler({ runtime });

    await expect(bridge.handle({ operation: "health" })).resolves.toEqual({
      ok: true,
      operation: "health",
      result: {
        name: "mind-weave-core",
        status: "ok"
      }
    });
    await expect(bridge.handle({ operation: "status" })).resolves.toEqual({
      ok: true,
      operation: "status",
      result: await runtime.getStatus()
    });
    await expect(bridge.handle({ operation: "config" })).resolves.toEqual({
      ok: true,
      operation: "config",
      result: await runtime.getConfigInfo()
    });
    await expect(bridge.handle({ operation: "sources.inspect" })).resolves.toEqual({
      ok: true,
      operation: "sources.inspect",
      result: await runtime.inspectSources()
    });
  });

  it("captures scan progress events and returns a final scan result", async () => {
    const runtime = new CapturingRuntime();
    const bridge = createShellBridgeHandler({ runtime });

    await expect(bridge.handle({ operation: "scan" })).resolves.toEqual({
      ok: true,
      operation: "scan",
      result: {
        status: "scanned"
      },
      events: [
        {
          type: "scan.progress",
          event: {
            type: "scan.started",
            sourceCount: 1
          }
        }
      ]
    });
    expect(runtime.scanCalls).toBe(1);
  });

  it("maps watch operations to explicit AppRuntime watch controls", async () => {
    const runtime = new CapturingRuntime();
    const bridge = createShellBridgeHandler({ runtime });

    await expect(bridge.handle({ operation: "watch.start" })).resolves.toEqual({
      ok: true,
      operation: "watch.start",
      result: {
        status: "running",
        watcherCount: 1
      }
    });
    await expect(bridge.handle({ operation: "watch.stop" })).resolves.toEqual({
      ok: true,
      operation: "watch.stop",
      result: {
        status: "stopped",
        watcherCount: 0
      }
    });
    expect(runtime.startWatchingCalls).toBe(1);
    expect(runtime.stopWatchingCalls).toBe(1);
  });

  it("returns structured errors for unsupported operations and runtime failures", async () => {
    const runtime = new CapturingRuntime();
    const bridge = createShellBridgeHandler({ runtime });

    await expect(bridge.handle({ operation: "query" })).resolves.toEqual({
      ok: false,
      operation: "query",
      error: {
        code: "SHELL_BRIDGE_UNSUPPORTED_OPERATION",
        message: "Unsupported shell bridge operation: query"
      }
    });

    runtime.failStatus = true;
    await expect(bridge.handle({ operation: "status" })).resolves.toEqual({
      ok: false,
      operation: "status",
      error: {
        code: "SHELL_BRIDGE_RUNTIME_ERROR",
        message: "status unavailable"
      }
    });
  });
});

class CapturingRuntime implements AppRuntime {
  scanCalls = 0;
  startWatchingCalls = 0;
  stopWatchingCalls = 0;
  failStatus = false;
  private watchStatus: RuntimeWatchStatus = {
    status: "stopped",
    watcherCount: 0
  };

  getHealth() {
    return {
      name: "mind-weave-core" as const,
      status: "ok" as const
    };
  }

  async getStatus() {
    if (this.failStatus) {
      throw new Error("status unavailable");
    }

    return {
      name: "mind-weave-core" as const,
      status: "configured" as const,
      sourceCount: 1,
      sources: [
        {
          id: "notes",
          type: "local-fs",
          name: "Notes",
          rootUri: "file:///notes",
          status: "active" as const
        }
      ],
      config: await this.getConfigInfo(),
      embedding: {
        provider: "openai-compatible",
        model: "text-embedding-3-small",
        readiness: {
          ready: true,
          apiKeyEnv: "OPENAI_API_KEY",
          apiKeyPresent: true,
          apiKeySource: "env" as const
        }
      },
      storage: {
        type: "sqlite",
        path: "/tmp/mind-weave.sqlite"
      },
      observability: {
        logPath: "/tmp/mindweave.log"
      },
      index: {
        documents: {
          indexed: 1,
          stale: 0,
          failed: 0,
          deleted: 0
        },
        chunks: 2,
        embeddings: 2,
        sources: []
      },
      watch: this.watchStatus,
      mcp: {
        enabled: true,
        access: "available" as const,
        transport: "stdio" as const,
        startStopSupported: false as const,
        setupCommand: "mindweave mcp --config /tmp/config.json"
      },
      unavailableCapabilities: []
    };
  }

  async getConfigInfo() {
    return {
      path: "/tmp/config.json",
      sources: [
        {
          id: "notes",
          type: "local-fs",
          name: "Notes",
          rootUri: "file:///notes",
          status: "active" as const
        }
      ],
      embedding: {
        provider: "openai-compatible",
        model: "text-embedding-3-small",
        baseUrl: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY"
      },
      storage: {
        type: "sqlite",
        path: "/tmp/mind-weave.sqlite"
      },
      observability: {
        logPath: "/tmp/mindweave.log"
      }
    };
  }

  async start(): Promise<void> {}

  async startWatching(): Promise<void> {
    this.startWatchingCalls += 1;
    this.watchStatus = {
      status: "running",
      watcherCount: 1
    };
  }

  async stopWatching(): Promise<void> {
    this.stopWatchingCalls += 1;
    this.watchStatus = {
      status: "stopped",
      watcherCount: 0
    };
  }

  async scan(options?: RuntimeScanOptions): Promise<void> {
    this.scanCalls += 1;
    options?.onProgress?.({
      type: "scan.started",
      sourceCount: 1
    });
  }

  async inspectSources() {
    return {
      sources: [
        {
          sourceId: "notes",
          name: "Notes",
          rootUri: "file:///notes",
          includedDocumentCount: 1,
          skipped: {
            excluded: 0,
            ignored: 0,
            unsupported: 0,
            symlink: 0
          },
          topLevelPathCounts: {
            "note.md": 1
          },
          sampleIncludedPaths: ["note.md"],
          sampleExcludedPaths: []
        }
      ]
    };
  }

  async query() {
    return [];
  }

  getMcpToolHandlers(): McpToolHandlers {
    return {
      async searchKnowledge() {
        return { results: [] };
      },
      async listSources() {
        return { sources: [] };
      }
    };
  }

  async stop(): Promise<void> {}
}
