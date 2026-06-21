import { describe, expect, it } from "vitest";
import { createShellPanelModel, createWatchControlState } from "./status-model.js";
import type {
  RuntimeStatusAvailable,
  ShellBridgeHealthResult
} from "./bridge-client.js";

describe("macOS shell status model", () => {
  it("enables only the watch action that matches the current runtime state", () => {
    expect(createWatchControlState("running")).toEqual({
      canStart: false,
      canStop: true
    });
    expect(createWatchControlState("stopped")).toEqual({
      canStart: true,
      canStop: false
    });
    expect(createWatchControlState("error")).toEqual({
      canStart: true,
      canStop: false
    });
    expect(createWatchControlState("starting")).toEqual({
      canStart: false,
      canStop: true
    });
    expect(createWatchControlState("unknown")).toEqual({
      canStart: true,
      canStop: false
    });
  });

  it("summarizes runtime and index status for the panel", () => {
    const model = createShellPanelModel({
      health: availableHealth(),
      runtimeStatus: availableRuntimeStatus()
    });

    expect(model).toEqual({
      title: "MindWeave",
      runtime: {
        label: "Runtime",
        status: "available",
        detail: "Core available"
      },
      provider: {
        label: "Provider",
        status: "ready",
        detail: "openai-compatible / text-embedding-3-small"
      },
      index: {
        label: "Index",
        status: "indexed",
        detail: "3 indexed, 1 stale, 0 failed, 12 chunks, 12 embeddings"
      },
      storage: {
        label: "Storage",
        detail: "/tmp/mind-weave.sqlite"
      },
      watch: {
        label: "Watch",
        status: "running",
        detail: "1 watcher"
      },
      mcp: {
        label: "MCP",
        status: "available",
        detail: "stdio / mindweave mcp --config /tmp/config.json"
      },
      config: {
        label: "Config",
        detail: "/tmp/config.json",
        primaryPath: "/tmp/config.json"
      },
      logs: {
        label: "Logs",
        detail: "/tmp/mind-weave.log",
        primaryPath: "/tmp/mind-weave.log"
      },
      sources: {
        label: "Sources",
        detail: "Notes: 3 indexed, 1 stale, 0 failed",
        primaryPath: "file:///notes"
      }
    });
  });

  it("summarizes source index status from runtime source metadata and document counts", () => {
    const status = availableRuntimeStatus();
    const model = createShellPanelModel({
      health: availableHealth(),
      runtimeStatus: {
        ...status,
        response: {
          ...status.response,
          result: {
            ...status.response.result,
            sources: [
              {
                id: "notes",
                type: "local-fs",
                name: "Personal Notes",
                rootUri: "file:///notes",
                status: "active"
              }
            ],
            index: {
              documents: {
                indexed: 73,
                stale: 0,
                failed: 0,
                deleted: 0
              },
              chunks: 620,
              embeddings: 620,
              sources: [
                {
                  sourceId: "notes",
                  documents: {
                    indexed: 73,
                    stale: 0,
                    failed: 0,
                    deleted: 0
                  }
                }
              ]
            }
          }
        }
      }
    });

    expect(model.sources).toEqual({
      label: "Sources",
      detail: "Personal Notes: 73 indexed, 0 stale, 0 failed",
      primaryPath: "file:///notes"
    });
  });

  it("keeps status unavailable when runtime status cannot be read", () => {
    const model = createShellPanelModel({
      health: {
        status: "unavailable",
        url: "http://127.0.0.1:7348/health",
        message: "connection refused"
      },
      runtimeStatus: {
        status: "unavailable",
        url: "http://127.0.0.1:7348/status",
        message: "connection refused"
      }
    });

    expect(model.runtime).toEqual({
      label: "Runtime",
      status: "unavailable",
      detail: "connection refused"
    });
    expect(model.index).toEqual({
      label: "Index",
      status: "unknown",
      detail: "Status unavailable"
    });
    expect(model.watch).toEqual({
      label: "Watch",
      status: "unknown",
      detail: "Status unavailable"
    });
    expect(model.mcp).toEqual({
      label: "MCP",
      status: "unknown",
      detail: "Status unavailable"
    });
    expect(model.config).toEqual({
      label: "Config",
      detail: "Status unavailable"
    });
  });
});

function availableHealth(): ShellBridgeHealthResult {
  return {
    status: "available",
    url: "http://127.0.0.1:7348/health",
    response: {
      ok: true,
      operation: "health",
      result: {
        name: "mind-weave-core",
        status: "ok"
      }
    }
  };
}

function availableRuntimeStatus(): RuntimeStatusAvailable {
  return {
    status: "available",
    url: "http://127.0.0.1:7348/status",
    response: {
      ok: true,
      operation: "status",
      result: {
        name: "mind-weave-core",
        status: "configured",
        sourceCount: 1,
        sources: [
          {
            id: "notes",
            type: "local-fs",
            name: "Notes",
            rootUri: "file:///notes",
            status: "active"
          }
        ],
        config: {
          path: "/tmp/config.json"
        },
        embedding: {
          provider: "openai-compatible",
          model: "text-embedding-3-small",
          readiness: {
            ready: true,
            apiKeyEnv: "OPENAI_API_KEY",
            apiKeyPresent: true,
            apiKeySource: "env"
          }
        },
        storage: {
          type: "sqlite",
          path: "/tmp/mind-weave.sqlite"
        },
        observability: {
          logPath: "/tmp/mind-weave.log"
        },
        index: {
          documents: {
            indexed: 3,
            stale: 1,
            failed: 0,
            deleted: 0
          },
          chunks: 12,
          embeddings: 12,
          sources: [
            {
              sourceId: "notes",
              documents: {
                indexed: 3,
                stale: 1,
                failed: 0,
                deleted: 0
              }
            }
          ]
        },
        watch: {
          status: "running",
          watcherCount: 1
        },
        mcp: {
          enabled: true,
          access: "available",
          transport: "stdio",
          startStopSupported: false,
          setupCommand: "mindweave mcp --config /tmp/config.json"
        }
      }
    }
  };
}
