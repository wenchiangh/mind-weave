import type {
  EmbeddingConfigIdentity,
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingResult
} from "./contracts.js";
import { EmbeddingProviderError } from "./errors.js";
import type { Vector } from "../shared/contracts.js";

type FetchLike = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    readonly body: string;
  }
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type OpenAICompatibleEmbeddingProviderOptions = {
  readonly model: string;
  readonly baseUrl: string;
  readonly apiKeyEnv: string;
  readonly dimensions?: number | undefined;
  readonly batchSize?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly fetch?: FetchLike | undefined;
  readonly env?: Record<string, string | undefined> | undefined;
};

type EmbeddingResponse = {
  readonly data: readonly {
    readonly embedding: readonly number[];
    readonly index?: number | undefined;
  }[];
};

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly config: EmbeddingConfigIdentity;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;
  private readonly env: Record<string, string | undefined>;
  private readonly endpoint: string;
  private readonly apiKeyEnv: string;

  constructor(options: OpenAICompatibleEmbeddingProviderOptions) {
    this.config = {
      provider: "openai-compatible",
      model: options.model,
      ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions })
    };
    this.batchSize = options.batchSize ?? 64;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.env = options.env ?? process.env;
    this.endpoint = `${options.baseUrl.replace(/\/+$/, "")}/embeddings`;
    this.apiKeyEnv = options.apiKeyEnv;
  }

  getConfig(): EmbeddingConfigIdentity {
    return this.config;
  }

  async embedDocuments(
    inputs: readonly EmbeddingInput[]
  ): Promise<readonly EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (let start = 0; start < inputs.length; start += this.batchSize) {
      const batch = inputs.slice(start, start + this.batchSize);
      const vectors = await this.requestEmbeddings(batch.map((input) => input.text));

      if (vectors.length !== batch.length) {
        throw new EmbeddingProviderError({
          kind: "invalid-request",
          message: `Embedding response length ${vectors.length} did not match input length ${batch.length}.`
        });
      }

      for (let index = 0; index < batch.length; index += 1) {
        const input = batch[index];
        const vector = vectors[index];

        if (input === undefined || vector === undefined) {
          continue;
        }

        results.push({
          inputId: input.id,
          vector,
          config: this.config
        });
      }
    }

    return results;
  }

  async embedQuery(text: string): Promise<Vector> {
    const [vector] = await this.requestEmbeddings([text]);
    if (vector === undefined) {
      throw new EmbeddingProviderError({
        kind: "invalid-request",
        message: "Embedding response did not include a query vector."
      });
    }

    return vector;
  }

  private async requestEmbeddings(inputs: readonly string[]): Promise<readonly Vector[]> {
    const apiKey = this.env[this.apiKeyEnv];
    if (apiKey === undefined || apiKey.length === 0) {
      throw new EmbeddingProviderError({
        kind: "configuration",
        message: `Missing API key environment variable: ${this.apiKeyEnv}`,
        retryable: false
      });
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      input: inputs
    };

    if (this.config.dimensions !== undefined) {
      body["dimensions"] = this.config.dimensions;
    }

    return this.withRetries(async () => {
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "authorization": `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        });
      } catch (error) {
        throw new EmbeddingProviderError({
          kind: "transient",
          message: "Embedding request failed before receiving a response.",
          cause: error
        });
      }

      if (!response.ok) {
        throw new EmbeddingProviderError({
          kind: classifyHttpStatus(response.status),
          status: response.status,
          message: await response.text()
        });
      }

      const payload = await response.json();
      return parseEmbeddingResponse(payload);
    });
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof EmbeddingProviderError)
          || !error.retryable
          || attempt >= this.maxRetries
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }
}

function parseEmbeddingResponse(payload: unknown): readonly Vector[] {
  if (!isEmbeddingResponse(payload)) {
    throw new EmbeddingProviderError({
      kind: "invalid-request",
      message: "Embedding response payload did not match expected shape."
    });
  }

  return [...payload.data]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => item.embedding);
}

function isEmbeddingResponse(payload: unknown): payload is EmbeddingResponse {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return false;
  }

  const data = (payload as { readonly data: unknown }).data;
  return Array.isArray(data) && data.every((item) =>
    typeof item === "object"
    && item !== null
    && Array.isArray((item as { readonly embedding?: unknown }).embedding)
    && (item as { readonly embedding: unknown[] }).embedding.every((value) =>
      typeof value === "number"
    )
  );
}

function classifyHttpStatus(status: number) {
  if (status === 401 || status === 403) {
    return "authentication";
  }

  if (status === 429) {
    return "rate-limit";
  }

  if (status === 408 || status === 409 || status === 425 || status >= 500) {
    return "transient";
  }

  return "invalid-request";
}
