import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storageFiles = [
  "contracts.ts",
  "errors.ts",
  "index.ts",
  "sqlite.ts"
];

describe("storage module boundary", () => {
  it("does not import config, app, interfaces, source provider implementation, processors, indexing, embeddings, or query modules", () => {
    const sourceText = storageFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../sources/local-fs");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../query/");
  });
});
