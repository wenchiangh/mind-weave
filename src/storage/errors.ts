export type StorageErrorCode =
  | "STORAGE_SCHEMA_INCOMPATIBLE"
  | "STORAGE_OPEN_FAILED"
  | "STORAGE_OPERATION_FAILED";

export type StorageErrorIssue = {
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly databasePath?: string | undefined;
};

type StorageErrorOptions = {
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly databasePath?: string | undefined;
  readonly issues?: readonly StorageErrorIssue[] | undefined;
  readonly cause?: unknown;
};

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly databasePath?: string | undefined;
  readonly issues: readonly StorageErrorIssue[];

  constructor(options: StorageErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "StorageError";
    this.code = options.code;
    this.databasePath = options.databasePath;
    this.issues = options.issues ?? [
      {
        code: options.code,
        message: options.message,
        databasePath: options.databasePath
      }
    ];
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}
