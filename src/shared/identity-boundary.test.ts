import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared identity boundary", () => {
  it("does not import domain modules", () => {
    const sourceText = readFileSync(new URL("./identity.ts", import.meta.url), "utf8");

    expect(sourceText).not.toContain("../config/");
    expect(sourceText).not.toContain("../app/");
    expect(sourceText).not.toContain("../interfaces/");
    expect(sourceText).not.toContain("../sources/");
    expect(sourceText).not.toContain("../storage/");
    expect(sourceText).not.toContain("../indexing/");
    expect(sourceText).not.toContain("../processors/");
    expect(sourceText).not.toContain("../embeddings/");
    expect(sourceText).not.toContain("../query/");
  });
});
