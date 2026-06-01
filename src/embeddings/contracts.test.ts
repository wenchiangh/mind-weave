import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "./contracts.js";

describe("EmbeddingProvider contract", () => {
  it("supports deterministic fake document and query embeddings", async () => {
    const provider: EmbeddingProvider = {
      getConfig: () => ({
        provider: "fake",
        model: "fake-small",
        dimensions: 3
      }),
      embedDocuments: async (inputs) =>
        inputs.map((input, index) => ({
          inputId: input.id,
          vector: [index, input.text.length, 1],
          config: provider.getConfig()
        })),
      embedQuery: async (text) => [text.length, 0, 1]
    };

    await expect(
      provider.embedDocuments([{ id: "chunk-1", text: "hello" }])
    ).resolves.toEqual([
      {
        inputId: "chunk-1",
        vector: [0, 5, 1],
        config: {
          provider: "fake",
          model: "fake-small",
          dimensions: 3
        }
      }
    ]);
    await expect(provider.embedQuery("hello")).resolves.toEqual([5, 0, 1]);
  });
});
