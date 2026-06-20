import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "contracts.ts",
  "errors.ts",
  "index.ts",
  "local-fs.ts"
];

describe("sources module boundary", () => {
  it("does not import config, app, interfaces, or downstream modules", () => {
    const sourceText = sourceFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../query/");
  });
});
