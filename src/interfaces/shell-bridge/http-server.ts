import http from "node:http";
import type { AddressInfo } from "node:net";
import type {
  ShellBridgeHandler,
  ShellBridgeOperation
} from "./contracts.js";

export type ShellBridgeHttpServerOptions = {
  readonly bridge: ShellBridgeHandler;
  readonly host: string;
  readonly port: number;
};

export type ShellBridgeHttpServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
  url(pathname: string): string;
};

type RouteDefinition = {
  readonly method: "GET" | "POST";
  readonly pathname: string;
  readonly operation: ShellBridgeOperation;
};

const routes: readonly RouteDefinition[] = [
  { method: "GET", pathname: "/health", operation: "health" },
  { method: "GET", pathname: "/status", operation: "status" },
  { method: "GET", pathname: "/config", operation: "config" },
  { method: "GET", pathname: "/sources/inspect", operation: "sources.inspect" },
  { method: "POST", pathname: "/scan", operation: "scan" },
  { method: "POST", pathname: "/watch/start", operation: "watch.start" },
  { method: "POST", pathname: "/watch/stop", operation: "watch.stop" }
];

export function createShellBridgeHttpServer(
  options: ShellBridgeHttpServerOptions
): ShellBridgeHttpServer {
  if (options.host !== "127.0.0.1" && options.host !== "localhost") {
    throw new Error("Shell bridge HTTP server must bind to 127.0.0.1 or localhost.");
  }

  const server = http.createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const pathRoutes = routes.filter((route) => route.pathname === pathname);
    const route = pathRoutes.find((candidate) => candidate.method === method);

    if (route === undefined) {
      if (pathRoutes.length > 0) {
        writeJson(response, 405, {
          ok: false,
          error: {
            code: "SHELL_BRIDGE_HTTP_METHOD_NOT_ALLOWED",
            message: `Method not allowed for shell bridge route: ${method} ${pathname}`
          }
        });
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: {
          code: "SHELL_BRIDGE_HTTP_NOT_FOUND",
          message: `Unknown shell bridge route: ${method} ${pathname}`
        }
      });
      return;
    }

    writeJson(response, 200, await options.bridge.handle({
      operation: route.operation
    }));
  });

  return {
    async start(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port, options.host, () => {
          server.off("error", reject);
          resolve();
        });
      });
    },
    async stop(): Promise<void> {
      if (!server.listening) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    url(pathname: string): string {
      const address = server.address() as AddressInfo | null;
      const port = address?.port ?? options.port;
      return `http://${options.host}:${port}${pathname}`;
    }
  };
}

function writeJson(
  response: http.ServerResponse,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
}
