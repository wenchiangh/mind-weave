import { fileURLToPath } from "node:url";
import type { AppRuntime } from "../../app/contracts.js";
import { createRuntimeFromConfigFile } from "../../app/runtime.js";
import type { ShellBridgeHandler } from "./contracts.js";
import { createShellBridgeHandler } from "./handler.js";
import {
  createShellBridgeHttpServer,
  type ShellBridgeHttpServer,
  type ShellBridgeHttpServerOptions
} from "./http-server.js";

export type ShellBridgeServeArgs = {
  readonly configPath: string;
  readonly host: string;
  readonly port: number;
};

export type ShellBridgeServeHandle = {
  readonly url: (pathname: string) => string;
  readonly stop: () => Promise<void>;
};

export type ShellBridgeServeDependencies = {
  readonly createRuntime?: ((configPath: string) => Promise<AppRuntime>) | undefined;
  readonly createBridgeHandler?: ((runtime: AppRuntime) => ShellBridgeHandler) | undefined;
  readonly createHttpServer?: ((options: ShellBridgeHttpServerOptions) => ShellBridgeHttpServer) | undefined;
};

export class ShellBridgeServeUsageError extends Error {
  readonly code = "SHELL_BRIDGE_SERVE_USAGE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ShellBridgeServeUsageError";
  }
}

export function parseShellBridgeServeArgs(args: readonly string[]): ShellBridgeServeArgs {
  const configPath = readOption(args, "--config");
  if (configPath === undefined) {
    throw new ShellBridgeServeUsageError("Missing required --config <path>.");
  }

  const host = readOption(args, "--host") ?? "127.0.0.1";
  const rawPort = readOption(args, "--port") ?? "0";
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ShellBridgeServeUsageError("Invalid --port value.");
  }

  return {
    configPath,
    host,
    port
  };
}

export async function runShellBridgeServer(
  args: readonly string[],
  dependencies: ShellBridgeServeDependencies = {}
): Promise<ShellBridgeServeHandle> {
  const serveArgs = parseShellBridgeServeArgs(args);
  const runtime = await (dependencies.createRuntime ?? createRuntimeFromConfigFile)(
    serveArgs.configPath
  );
  const createBridge = dependencies.createBridgeHandler
    ?? ((runtimeToBridge: AppRuntime) => createShellBridgeHandler({ runtime: runtimeToBridge }));
  const bridge = createBridge(runtime);
  const server = (dependencies.createHttpServer ?? createShellBridgeHttpServer)({
    bridge,
    host: serveArgs.host,
    port: serveArgs.port
  });

  await server.start();

  return {
    url: (pathname) => server.url(pathname),
    stop: async () => {
      await server.stop();
      await runtime.stop();
    }
  };
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;

  if (value === undefined || value.length === 0 || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function runFromProcess(): Promise<void> {
  const handle = await runShellBridgeServer(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify({
    status: "listening",
    healthUrl: handle.url("/health")
  })}\n`);

  const stop = async () => {
    await handle.stop();
  };

  process.once("SIGINT", () => {
    void stop().finally(() => {
      process.exitCode = 0;
    });
  });
  process.once("SIGTERM", () => {
    void stop().finally(() => {
      process.exitCode = 0;
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runFromProcess().catch((error: unknown) => {
    const code = error instanceof ShellBridgeServeUsageError
      ? error.code
      : "SHELL_BRIDGE_SERVE_UNKNOWN_ERROR";
    const message = error instanceof Error ? error.message : "Unknown shell bridge server error.";

    process.stderr.write(`${JSON.stringify({ code, message })}\n`);
    process.exitCode = 1;
  });
}
