import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const processorFiles = [
  "contracts.ts",
  "index.ts",
  "markdown.ts"
];

describe("processors module boundary", () => {
  it("does not import config, app, interfaces, storage, indexing, embeddings, or query modules", () => {
    const sourceText = processorFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../query/");
    expect(sourceText).not.toContain("../sources/local-fs");
  });
});
