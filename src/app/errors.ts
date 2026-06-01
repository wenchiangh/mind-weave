import type {
  AppErrorCode,
  AppErrorIssue,
  RuntimeCapability
} from "./contracts.js";

type AppErrorOptions = {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly capability?: RuntimeCapability | undefined;
  readonly issues?: readonly AppErrorIssue[] | undefined;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly capability?: RuntimeCapability | undefined;
  readonly issues: readonly AppErrorIssue[];

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.capability = options.capability;
    this.issues = options.issues ?? [
      {
        code: options.code,
        message: options.message,
        capability: options.capability
      }
    ];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
