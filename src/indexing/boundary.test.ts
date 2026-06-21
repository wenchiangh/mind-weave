import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexingFiles = [
  "contracts.ts",
  "index.ts",
  "queue.ts"
];

describe("indexing module boundary", () => {
  it("does not import config, app, interfaces, source provider implementation, processors, embeddings, storage, or query modules", () => {
    const sourceText = indexingFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../sources/local-fs");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../query/");
  });
});
