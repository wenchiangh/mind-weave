import type {
  RuntimeScanProgressEvent
} from "../../app/contracts.js";

export type ShellBridgeOperation =
  | "health"
  | "status"
  | "config"
  | "sources.inspect"
  | "scan"
  | "watch.start"
  | "watch.stop";

export type ShellBridgeRequest = {
  readonly operation: string;
};

export type ShellBridgeEvent = {
  readonly type: "scan.progress";
  readonly event: RuntimeScanProgressEvent;
};

export type ShellBridgeSuccessResponse = {
  readonly ok: true;
  readonly operation: ShellBridgeOperation;
  readonly result: unknown;
  readonly events?: readonly ShellBridgeEvent[];
};

export type ShellBridgeErrorCode =
  | "SHELL_BRIDGE_UNSUPPORTED_OPERATION"
  | "SHELL_BRIDGE_RUNTIME_ERROR";

export type ShellBridgeErrorResponse = {
  readonly ok: false;
  readonly operation?: string | undefined;
  readonly error: {
    readonly code: ShellBridgeErrorCode;
    readonly message: string;
  };
};

export type ShellBridgeResponse =
  | ShellBridgeSuccessResponse
  | ShellBridgeErrorResponse;

export interface ShellBridgeHandler {
  handle(request: ShellBridgeRequest): Promise<ShellBridgeResponse>;
}
