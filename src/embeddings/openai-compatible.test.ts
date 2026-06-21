import { describe, expect, it } from "vitest";
import { isEmbeddingProviderError } from "./errors.js";
import { OpenAICompatibleEmbeddingProvider } from "./openai-compatible.js";

type FetchCall = {
  readonly input: string;
  readonly init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    readonly body: string;
  };
};

type MockResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly payload?: unknown;
  readonly text?: string;
};

function createFetch(responses: readonly (MockResponse | Error)[]): {
  readonly calls: FetchCall[];
  readonly fetch: (input: string, init: FetchCall["init"]) => Promise<{
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }>;
} {
  const calls: FetchCall[] = [];
  const queue = [...responses];

  return {
    calls,
    fetch: async (input, init) => {
      calls.push({ input, init });
      const response = queue.shift();

      if (response instanceof Error) {
        throw response;
      }

      if (response === undefined) {
        throw new Error("No mock response configured.");
      }

      return {
        ok: response.ok,
        status: response.status,
        json: async () => response.payload,
        text: async () => response.text ?? ""
      };
    }
  };
}

function createProvider(fetch: ReturnType<typeof createFetch>["fetch"]) {
  return new OpenAICompatibleEmbeddingProvider({
    model: "text-embedding-3-small",
    baseUrl: "https://example.test/v1/",
    apiKeyEnv: "OPENAI_API_KEY",
    dimensions: 3,
    batchSize: 2,
    maxRetries: 2,
    fetch,
    env: {
      OPENAI_API_KEY: "test-key"
    }
  });
}

describe("OpenAICompatibleEmbeddingProvider", () => {
  it("builds embedding requests and maps document vectors to input IDs", async () => {
    const mock = createFetch([
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [1, 0, 0] },
            { index: 1, embedding: [0, 1, 0] }
          ]
        }
      }
    ]);
    const provider = createProvider(mock.fetch);

    await expect(provider.embedDocuments([
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" }
    ])).resolves.toEqual([
      {
        inputId: "a",
        vector: [1, 0, 0],
        config: provider.getConfig()
      },
      {
        inputId: "b",
        vector: [0, 1, 0],
        config: provider.getConfig()
      }
    ]);

    expect(mock.calls[0]?.input).toBe("https://example.test/v1/embeddings");
    expect(mock.calls[0]?.init.headers).toEqual({
      authorization: "Bearer test-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(mock.calls[0]?.init.body ?? "")).toEqual({
      model: "text-embedding-3-small",
      input: ["alpha", "beta"],
      dimensions: 3
    });
  });

  it("omits dimensions when not configured", async () => {
    const mock = createFetch([
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [1, 0] }
          ]
        }
      }
    ]);
    const provider = new OpenAICompatibleEmbeddingProvider({
      model: "model",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      fetch: mock.fetch,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });

    await provider.embedQuery("hello");

    expect(JSON.parse(mock.calls[0]?.init.body ?? "")).toEqual({
      model: "model",
      input: ["hello"]
    });
  });

  it("batches document embedding requests and preserves output order", async () => {
    const mock = createFetch([
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [1] },
            { index: 1, embedding: [2] }
          ]
        }
      },
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [3] }
          ]
        }
      }
    ]);
    const provider = createProvider(mock.fetch);

    const results = await provider.embedDocuments([
      { id: "a", text: "a" },
      { id: "b", text: "b" },
      { id: "c", text: "c" }
    ]);

    expect(mock.calls).toHaveLength(2);
    expect(results.map((result) => result.inputId)).toEqual(["a", "b", "c"]);
    expect(results.map((result) => result.vector)).toEqual([[1], [2], [3]]);
  });

  it("embeds query text", async () => {
    const mock = createFetch([
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [0.1, 0.2] }
          ]
        }
      }
    ]);

    await expect(createProvider(mock.fetch).embedQuery("hello")).resolves.toEqual([
      0.1,
      0.2
    ]);
  });

  it("returns configuration error for missing API key", async () => {
    const provider = new OpenAICompatibleEmbeddingProvider({
      model: "model",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "MISSING_KEY",
      fetch: createFetch([]).fetch,
      env: {}
    });

    await provider.embedQuery("hello").catch((error: unknown) => {
      expect(isEmbeddingProviderError(error)).toBe(true);
      if (isEmbeddingProviderError(error)) {
        expect(error.kind).toBe("configuration");
        expect(error.retryable).toBe(false);
      }
    });
  });

  it("does not retry authentication or invalid request errors", async () => {
    for (const [status, kind] of [[401, "authentication"], [400, "invalid-request"]] as const) {
      const mock = createFetch([
        {
          ok: false,
          status,
          text: "failed"
        }
      ]);

      await createProvider(mock.fetch).embedQuery("hello").catch((error: unknown) => {
        expect(isEmbeddingProviderError(error)).toBe(true);
        if (isEmbeddingProviderError(error)) {
          expect(error.kind).toBe(kind);
          expect(error.retryable).toBe(false);
          expect(error.status).toBe(status);
        }
      });
      expect(mock.calls).toHaveLength(1);
    }
  });

  it("retries rate-limit and transient errors", async () => {
    const mock = createFetch([
      {
        ok: false,
        status: 429,
        text: "rate limited"
      },
      new Error("network"),
      {
        ok: true,
        status: 200,
        payload: {
          data: [
            { index: 0, embedding: [1] }
          ]
        }
      }
    ]);

    await expect(createProvider(mock.fetch).embedQuery("hello")).resolves.toEqual([1]);
    expect(mock.calls).toHaveLength(3);
  });

  it("throws retryable error after retry limit is exhausted", async () => {
    const mock = createFetch([
      {
        ok: false,
        status: 500,
        text: "server error"
      },
      {
        ok: false,
        status: 500,
        text: "server error"
      },
      {
        ok: false,
        status: 500,
        text: "server error"
      }
    ]);

    await createProvider(mock.fetch).embedQuery("hello").catch((error: unknown) => {
      expect(isEmbeddingProviderError(error)).toBe(true);
      if (isEmbeddingProviderError(error)) {
        expect(error.kind).toBe("transient");
        expect(error.retryable).toBe(true);
      }
    });
    expect(mock.calls).toHaveLength(3);
  });
});
