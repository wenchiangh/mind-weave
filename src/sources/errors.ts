import type { SourceId } from "./contracts.js";

export type SourceErrorCode =
  | "SOURCE_UNSUPPORTED_TYPE"
  | "SOURCE_ROOT_MISSING"
  | "SOURCE_ROOT_INVALID"
  | "SOURCE_SCAN_FAILED";

export type SourceErrorIssue = {
  readonly code: SourceErrorCode;
  readonly message: string;
  readonly sourceId?: SourceId | undefined;
  readonly path?: string | undefined;
};

type SourceErrorOptions = {
  readonly code: SourceErrorCode;
  readonly message: string;
  readonly sourceId?: SourceId | undefined;
  readonly path?: string | undefined;
  readonly issues?: readonly SourceErrorIssue[] | undefined;
  readonly cause?: unknown;
};

export class SourceError extends Error {
  readonly code: SourceErrorCode;
  readonly sourceId?: SourceId | undefined;
  readonly path?: string | undefined;
  readonly issues: readonly SourceErrorIssue[];

  constructor(options: SourceErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "SourceError";
    this.code = options.code;
    this.sourceId = options.sourceId;
    this.path = options.path;
    this.issues = options.issues ?? [
      {
        code: options.code,
        message: options.message,
        sourceId: options.sourceId,
        path: options.path
      }
    ];
  }
}

export function isSourceError(error: unknown): error is SourceError {
  return error instanceof SourceError;
}
