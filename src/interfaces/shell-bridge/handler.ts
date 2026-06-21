import type { AppRuntime } from "../../app/contracts.js";
import type {
  ShellBridgeEvent,
  ShellBridgeHandler,
  ShellBridgeOperation,
  ShellBridgeRequest,
  ShellBridgeResponse
} from "./contracts.js";

export type ShellBridgeHandlerOptions = {
  readonly runtime: AppRuntime;
};

export function createShellBridgeHandler(
  options: ShellBridgeHandlerOptions
): ShellBridgeHandler {
  return {
    async handle(request: ShellBridgeRequest): Promise<ShellBridgeResponse> {
      if (!isSupportedOperation(request.operation)) {
        return {
          ok: false,
          operation: request.operation,
          error: {
            code: "SHELL_BRIDGE_UNSUPPORTED_OPERATION",
            message: `Unsupported shell bridge operation: ${request.operation}`
          }
        };
      }

      try {
        return await handleSupportedOperation(options.runtime, request.operation);
      } catch (error) {
        return {
          ok: false,
          operation: request.operation,
          error: {
            code: "SHELL_BRIDGE_RUNTIME_ERROR",
            message: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  };
}

async function handleSupportedOperation(
  runtime: AppRuntime,
  operation: ShellBridgeOperation
): Promise<ShellBridgeResponse> {
  if (operation === "health") {
    return success(operation, runtime.getHealth());
  }

  if (operation === "status") {
    return success(operation, await runtime.getStatus());
  }

  if (operation === "config") {
    return success(operation, await runtime.getConfigInfo());
  }

  if (operation === "sources.inspect") {
    return success(operation, await runtime.inspectSources());
  }

  if (operation === "scan") {
    const events: ShellBridgeEvent[] = [];
    await runtime.scan({
      onProgress: (event) => {
        events.push({
          type: "scan.progress",
          event
        });
      }
    });

    return {
      ok: true,
      operation,
      result: {
        status: "scanned"
      },
      events
    };
  }

  if (operation === "watch.start") {
    await runtime.startWatching();
    return success(operation, (await runtime.getStatus()).watch);
  }

  await runtime.stopWatching();
  return success(operation, (await runtime.getStatus()).watch);
}

function success(
  operation: ShellBridgeOperation,
  result: unknown
): ShellBridgeResponse {
  return {
    ok: true,
    operation,
    result
  };
}

function isSupportedOperation(operation: string): operation is ShellBridgeOperation {
  return operation === "health"
    || operation === "status"
    || operation === "config"
    || operation === "sources.inspect"
    || operation === "scan"
    || operation === "watch.start"
    || operation === "watch.stop";
}
