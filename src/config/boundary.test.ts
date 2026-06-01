import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const configSources = [
  "contracts.ts",
  "effective.ts",
  "errors.ts",
  "index.ts",
  "load.ts",
  "validate.ts"
];

describe("config module boundary", () => {
  it("does not import runtime, interface adapters, or downstream implementations", () => {
    const sourceText = configSources.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../app/");
  });
});
