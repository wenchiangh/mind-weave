import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const embeddingFiles = [
  "contracts.ts",
  "errors.ts",
  "fake.ts",
  "index.ts",
  "openai-compatible.ts"
];

describe("embeddings module boundary", () => {
  it("does not import config, app, interfaces, storage, indexing, processors, sources, or query modules", () => {
    const sourceText = embeddingFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../sources/");
    expect(sourceText).not.toContain("../query/");
  });
});
