import type { EmbeddingProviderErrorKind } from "./contracts.js";

type EmbeddingProviderErrorOptions = {
  readonly kind: EmbeddingProviderErrorKind;
  readonly message: string;
  readonly status?: number | undefined;
  readonly retryable?: boolean | undefined;
  readonly cause?: unknown;
};

export class EmbeddingProviderError extends Error {
  readonly kind: EmbeddingProviderErrorKind;
  readonly status?: number | undefined;
  readonly retryable: boolean;

  constructor(options: EmbeddingProviderErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "EmbeddingProviderError";
    this.kind = options.kind;
    this.status = options.status;
    this.retryable = options.retryable ?? isRetryableKind(options.kind);
  }
}

export function isEmbeddingProviderError(
  error: unknown
): error is EmbeddingProviderError {
  return error instanceof EmbeddingProviderError;
}

export function isRetryableKind(kind: EmbeddingProviderErrorKind): boolean {
  return kind === "rate-limit" || kind === "transient";
}
