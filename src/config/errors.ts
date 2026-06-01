export type ConfigErrorCode =
  | "CONFIG_FILE_READ_FAILED"
  | "CONFIG_JSONC_PARSE_FAILED"
  | "CONFIG_SCHEMA_INVALID"
  | "CONFIG_REGEX_INVALID"
  | "CONFIG_NESTED_SOURCES"
  | "CONFIG_UNSUPPORTED_SOURCE_TYPE"
  | "CONFIG_UNSUPPORTED_STORAGE_TYPE"
  | "CONFIG_UNSUPPORTED_EMBEDDING_TYPE";

export type ConfigErrorIssue = {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly path?: string | undefined;
};

type ConfigErrorOptions = {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly path?: string | undefined;
  readonly issues?: readonly ConfigErrorIssue[] | undefined;
  readonly cause?: unknown;
};

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly path?: string | undefined;
  readonly issues: readonly ConfigErrorIssue[];

  constructor(options: ConfigErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ConfigError";
    this.code = options.code;
    this.path = options.path;
    this.issues = options.issues ?? [
      {
        code: options.code,
        message: options.message,
        path: options.path
      }
    ];
  }
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}
