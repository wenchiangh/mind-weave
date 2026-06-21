import { describe, expect, it } from "vitest";
import {
  readBridgeHealth,
  readRuntimeStatus,
  startWatch,
  stopWatch,
  triggerScan
} from "./bridge-client.js";

describe("macOS shell bridge client", () => {
  it("reads sidecar health from the loopback bridge", async () => {
    const result = await readBridgeHealth({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async (url) => new Response(JSON.stringify({
        ok: true,
        operation: "health",
        result: {
          name: "mind-weave-core",
          status: "ok"
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    });

    expect(result).toEqual({
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
    });
  });

  it("returns unavailable when the bridge cannot be reached", async () => {
    const result = await readBridgeHealth({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async () => {
        throw new Error("connection refused");
      }
    });

    expect(result).toEqual({
      status: "unavailable",
      url: "http://127.0.0.1:7348/health",
      message: "connection refused"
    });
  });
});

describe("macOS shell runtime status client", () => {
  it("reads runtime status from the loopback bridge", async () => {
    const result = await readRuntimeStatus({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async (url) => new Response(JSON.stringify({
        ok: true,
        operation: "status",
        result: {
          name: "mind-weave-core",
          status: "configured",
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
          }
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    });

    expect(result).toMatchObject({
      status: "available",
      url: "http://127.0.0.1:7348/status",
      response: {
        ok: true,
        operation: "status"
      }
    });
  });

  it("returns unavailable when runtime status fetch fails", async () => {
    const result = await readRuntimeStatus({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async () => {
        throw new Error("connection refused");
      }
    });

    expect(result).toEqual({
      status: "unavailable",
      url: "http://127.0.0.1:7348/status",
      message: "connection refused"
    });
  });

  it("returns unavailable when the bridge returns a structured status error", async () => {
    const result = await readRuntimeStatus({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async () => new Response(JSON.stringify({
        ok: false,
        operation: "status",
        error: {
          code: "SHELL_BRIDGE_RUNTIME_ERROR",
          message: "status unavailable"
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    });

    expect(result).toEqual({
      status: "unavailable",
      url: "http://127.0.0.1:7348/status",
      message: "status unavailable"
    });
  });
});

describe("macOS shell scan and watch command client", () => {
  it("posts scan and watch commands to the loopback bridge", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.toString()}`);
      return new Response(JSON.stringify({
        ok: true,
        operation: "scan",
        result: {
          status: "scanned"
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    };

    await triggerScan({
      baseUrl: "http://127.0.0.1:7348",
      fetch: fetchImpl
    });
    await startWatch({
      baseUrl: "http://127.0.0.1:7348",
      fetch: fetchImpl
    });
    await stopWatch({
      baseUrl: "http://127.0.0.1:7348",
      fetch: fetchImpl
    });

    expect(calls).toEqual([
      "POST http://127.0.0.1:7348/scan",
      "POST http://127.0.0.1:7348/watch/start",
      "POST http://127.0.0.1:7348/watch/stop"
    ]);
  });

  it("returns unavailable when a command returns a structured bridge error", async () => {
    const result = await triggerScan({
      baseUrl: "http://127.0.0.1:7348",
      fetch: async () => new Response(JSON.stringify({
        ok: false,
        operation: "scan",
        error: {
          code: "SHELL_BRIDGE_RUNTIME_ERROR",
          message: "scan failed"
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    });

    expect(result).toEqual({
      status: "unavailable",
      url: "http://127.0.0.1:7348/scan",
      message: "scan failed"
    });
  });
});
