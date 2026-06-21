import { describe, expect, it } from "vitest";
import { FakeEmbeddingProvider } from "./fake.js";

describe("FakeEmbeddingProvider", () => {
  it("returns deterministic document embeddings", async () => {
    const provider = new FakeEmbeddingProvider({
      dimensions: 4
    });

    await expect(provider.embedDocuments([
      { id: "a", text: "same" },
      { id: "b", text: "different" }
    ])).resolves.toEqual([
      {
        inputId: "a",
        vector: await provider.embedQuery("same"),
        config: provider.getConfig()
      },
      {
        inputId: "b",
        vector: await provider.embedQuery("different"),
        config: provider.getConfig()
      }
    ]);
  });

  it("respects configured dimensions and changes vector by text", async () => {
    const provider = new FakeEmbeddingProvider({
      dimensions: 6
    });

    const first = await provider.embedQuery("first");
    const second = await provider.embedQuery("second");

    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);
    expect(first).not.toEqual(second);
  });

  it("exposes config identity", () => {
    expect(new FakeEmbeddingProvider({
      provider: "fake-provider",
      model: "fake-model",
      dimensions: 3
    }).getConfig()).toEqual({
      provider: "fake-provider",
      model: "fake-model",
      dimensions: 3
    });
  });
});
