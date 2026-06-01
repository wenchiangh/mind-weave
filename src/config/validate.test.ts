import { describe, expect, it } from "vitest";
import { isConfigError } from "./errors.js";
import { validateUserConfig } from "./validate.js";

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected function to throw.");
}

const validConfig = {
  sources: [
    {
      type: "local-fs",
      rootPath: "./notes"
    }
  ],
  embedding: {
    provider: "openai-compatible",
    model: "text-embedding-3-small",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY"
  },
  storage: {
    type: "sqlite",
    path: "./mind-weave.sqlite"
  }
};

describe("validateUserConfig", () => {
  it("accepts the minimal P0 config shape", () => {
    expect(validateUserConfig(validConfig)).toEqual(validConfig);
  });

  it("rejects missing sources", () => {
    const error = captureError(() => validateUserConfig({
      embedding: validConfig.embedding,
      storage: validConfig.storage
    }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_SCHEMA_INVALID");
      expect(error.issues[0]?.path).toBe("sources");
    }
  });

  it("rejects an empty source list", () => {
    const error = captureError(() => validateUserConfig({
      ...validConfig,
      sources: []
    }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_SCHEMA_INVALID");
      expect(error.issues[0]?.path).toBe("sources");
    }
  });

  it("rejects unsupported source type", () => {
    const error = captureError(() => validateUserConfig({
      ...validConfig,
      sources: [
        {
          type: "obsidian-vault",
          rootPath: "./notes"
        }
      ]
    }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_UNSUPPORTED_SOURCE_TYPE");
      expect(error.issues[0]?.path).toBe("sources.0.type");
    }
  });

  it("rejects unsupported embedding and storage types", () => {
    const error = captureError(() => validateUserConfig({
      ...validConfig,
      embedding: {
        ...validConfig.embedding,
        provider: "other-provider"
      },
      storage: {
        ...validConfig.storage,
        type: "postgres"
      }
    }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.issues.map((issue) => issue.code)).toContain(
        "CONFIG_UNSUPPORTED_EMBEDDING_TYPE"
      );
      expect(error.issues.map((issue) => issue.code)).toContain(
        "CONFIG_UNSUPPORTED_STORAGE_TYPE"
      );
    }
  });

  it("rejects invalid embedding dimensions and batch size", () => {
    const error = captureError(() => validateUserConfig({
      ...validConfig,
      embedding: {
        ...validConfig.embedding,
        dimensions: 0,
        batchSize: -1
      }
    }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.issues.map((issue) => issue.path)).toEqual([
        "embedding.dimensions",
        "embedding.batchSize"
      ]);
    }
  });
});
