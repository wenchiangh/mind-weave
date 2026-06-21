import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shell bridge boundary", () => {
  it("does not import lower-level core modules or concrete transports", () => {
    const files = [
      new URL("./contracts.ts", import.meta.url),
      new URL("./handler.ts", import.meta.url),
      new URL("./index.ts", import.meta.url)
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source).not.toContain("../../sources/");
    expect(source).not.toContain("../../processors/");
    expect(source).not.toContain("../../embeddings/");
    expect(source).not.toContain("../../storage/");
    expect(source).not.toContain("../../query/");
    expect(source).not.toContain("../../indexing/");
    expect(source).not.toContain("../../config/");
    expect(source).not.toContain("../cli/");
    expect(source).not.toContain("node:http");
    expect(source).not.toContain("@tauri-apps/");
  });
});
