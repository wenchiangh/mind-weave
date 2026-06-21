import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const queryFiles = [
  "contracts.ts",
  "index.ts",
  "service.ts"
];

describe("query module boundary", () => {
  it("does not import adapters, concrete storage, source providers, processors, or indexing modules", () => {
    const sourceText = queryFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../sources/");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../storage/sqlite");
    expect(sourceText).not.toContain("../embeddings/fake");
    expect(sourceText).not.toContain("../embeddings/openai-compatible");
  });
});
