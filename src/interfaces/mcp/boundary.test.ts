import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mcpFiles = [
  "index.ts",
  "tools.ts"
];

describe("MCP adapter boundary", () => {
  it("does not import concrete core implementations or non-query indexing internals", () => {
    const sourceText = mcpFiles.map((fileName) =>
      readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8")
    ).join("\n");

    expect(sourceText).not.toContain("../../storage/sqlite");
    expect(sourceText).not.toContain("../../sources/local-fs");
    expect(sourceText).not.toContain("../../processors/");
    expect(sourceText).not.toContain("../../embeddings/");
    expect(sourceText).not.toContain("../../indexing/");
    expect(sourceText).not.toContain("../../config/");
    expect(sourceText).not.toContain("../../app/");
    expect(sourceText).not.toContain("../cli/");
  });
});
