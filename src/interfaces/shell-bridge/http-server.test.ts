import { request } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ShellBridgeHandler,
  ShellBridgeRequest,
  ShellBridgeResponse
} from "./contracts.js";
import { createShellBridgeHttpServer } from "./http-server.js";

describe("shell bridge HTTP server", () => {
  it("serves shell bridge operations over loopback HTTP", async () => {
    const bridge = new CapturingShellBridge();
    const server = createShellBridgeHttpServer({
      bridge,
      host: "127.0.0.1",
      port: 0
    });

    await server.start();
    try {
      await expect(getJson(server.url("/health"))).resolves.toEqual({
        status: 200,
        body: {
          ok: true,
          operation: "health",
          result: {
            route: "health"
          }
        }
      });
      await expect(getJson(server.url("/status"))).resolves.toMatchObject({
        status: 200,
        body: {
          operation: "status"
        }
      });
      await expect(postJson(server.url("/watch/start"))).resolves.toMatchObject({
        status: 200,
        body: {
          operation: "watch.start"
        }
      });
      expect(bridge.operations).toEqual([
        "health",
        "status",
        "watch.start"
      ]);
    } finally {
      await server.stop();
    }
  });

  it("maps all MVP routes to shell bridge operations", async () => {
    const bridge = new CapturingShellBridge();
    const server = createShellBridgeHttpServer({
      bridge,
      host: "127.0.0.1",
      port: 0
    });

    await server.start();
    try {
      await getJson(server.url("/config"));
      await getJson(server.url("/sources/inspect"));
      await postJson(server.url("/scan"));
      await postJson(server.url("/watch/stop"));

      expect(bridge.operations).toEqual([
        "config",
        "sources.inspect",
        "scan",
        "watch.stop"
      ]);
    } finally {
      await server.stop();
    }
  });

  it("returns structured errors for unknown routes and invalid methods", async () => {
    const server = createShellBridgeHttpServer({
      bridge: new CapturingShellBridge(),
      host: "127.0.0.1",
      port: 0
    });

    await server.start();
    try {
      await expect(getJson(server.url("/missing"))).resolves.toEqual({
        status: 404,
        body: {
          ok: false,
          error: {
            code: "SHELL_BRIDGE_HTTP_NOT_FOUND",
            message: "Unknown shell bridge route: GET /missing"
          }
        }
      });
      await expect(postJson(server.url("/status"))).resolves.toEqual({
        status: 405,
        body: {
          ok: false,
          error: {
            code: "SHELL_BRIDGE_HTTP_METHOD_NOT_ALLOWED",
            message: "Method not allowed for shell bridge route: POST /status"
          }
        }
      });
    } finally {
      await server.stop();
    }
  });

  it("allows the local Tauri webview origin to call the loopback bridge", async () => {
    const server = createShellBridgeHttpServer({
      bridge: new CapturingShellBridge(),
      host: "127.0.0.1",
      port: 0
    });

    await server.start();
    try {
      await expect(requestJson("OPTIONS", server.url("/status"), {
        origin: "tauri://localhost"
      })).resolves.toMatchObject({
        status: 204,
        headers: {
          "access-control-allow-origin": "tauri://localhost",
          "access-control-allow-methods": "GET, POST, OPTIONS"
        },
        body: ""
      });

      await expect(requestJson("GET", server.url("/status"), {
        origin: "tauri://localhost"
      })).resolves.toMatchObject({
        status: 200,
        headers: {
          "access-control-allow-origin": "tauri://localhost"
        }
      });
    } finally {
      await server.stop();
    }
  });

  it("rejects non-loopback bind hosts", () => {
    expect(() => createShellBridgeHttpServer({
      bridge: new CapturingShellBridge(),
      host: "0.0.0.0",
      port: 0
    })).toThrow("Shell bridge HTTP server must bind to 127.0.0.1 or localhost.");
  });
});

class CapturingShellBridge implements ShellBridgeHandler {
  readonly operations: string[] = [];

  async handle(request: ShellBridgeRequest): Promise<ShellBridgeResponse> {
    this.operations.push(request.operation);
    return {
      ok: true,
      operation: request.operation as never,
      result: {
        route: request.operation
      }
    };
  }
}

function getJson(url: string): Promise<{
  readonly status: number;
  readonly body: unknown;
}> {
  return requestJson("GET", url).then(stripHeaders);
}

function postJson(url: string): Promise<{
  readonly status: number;
  readonly body: unknown;
}> {
  return requestJson("POST", url).then(stripHeaders);
}

function requestJson(method: string, url: string, headers: Record<string, string> = {}): Promise<{
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: body === "" ? "" : JSON.parse(body) as unknown
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function stripHeaders(result: {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
}): {
  readonly status: number;
  readonly body: unknown;
} {
  return {
    status: result.status,
    body: result.body
  };
}
