import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCli } from "./main.js";

describe("runCli", () => {
  it("prints runtime health as JSON", () => {
    const writes: string[] = [];
    const exitCode = runCli(["health"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(0);
    expect(writes).toEqual([
      "{\"name\":\"mind-weave-core\",\"status\":\"ok\"}\n"
    ]);
  });

  it("prints usage for unknown commands", () => {
    const writes: string[] = [];
    const exitCode = runCli(["unknown"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(1);
    expect(writes).toEqual([
      "Usage: mindweave health\n"
    ]);
  });

  it("keeps the CLI adapter from importing lower-level core modules directly", () => {
    const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../../sources/");
    expect(source).not.toContain("../../processors/");
    expect(source).not.toContain("../../embeddings/");
    expect(source).not.toContain("../../storage/");
    expect(source).not.toContain("../../query/");
    expect(source).not.toContain("../../indexing/");
  });
});
