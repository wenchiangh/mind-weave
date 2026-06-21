import crypto from "node:crypto";
import type {
  EmbeddingConfigIdentity,
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingResult
} from "./contracts.js";
import type { Vector } from "../shared/contracts.js";

export type FakeEmbeddingProviderOptions = {
  readonly provider?: string | undefined;
  readonly model?: string | undefined;
  readonly dimensions?: number | undefined;
};

export class FakeEmbeddingProvider implements EmbeddingProvider {
  private readonly config: EmbeddingConfigIdentity;

  constructor(options: FakeEmbeddingProviderOptions = {}) {
    this.config = {
      provider: options.provider ?? "fake",
      model: options.model ?? "fake-embedding",
      dimensions: options.dimensions ?? 8
    };
  }

  getConfig(): EmbeddingConfigIdentity {
    return this.config;
  }

  async embedDocuments(
    inputs: readonly EmbeddingInput[]
  ): Promise<readonly EmbeddingResult[]> {
    return inputs.map((input) => ({
      inputId: input.id,
      vector: createDeterministicVector(input.text, this.config.dimensions ?? 8),
      config: this.config
    }));
  }

  async embedQuery(text: string): Promise<Vector> {
    return createDeterministicVector(text, this.config.dimensions ?? 8);
  }
}

function createDeterministicVector(text: string, dimensions: number): Vector {
  const values: number[] = [];
  let counter = 0;

  while (values.length < dimensions) {
    const hash = crypto.createHash("sha256")
      .update(text)
      .update(String(counter))
      .digest();

    for (let offset = 0; offset < hash.length && values.length < dimensions; offset += 4) {
      const raw = hash.readUInt32BE(offset);
      values.push(raw / 0xffffffff);
    }

    counter += 1;
  }

  return values;
}
