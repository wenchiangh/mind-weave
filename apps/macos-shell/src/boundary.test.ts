import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shellSrcRoot = join(process.cwd(), "apps", "macos-shell", "src");

describe("macOS shell app boundary", () => {
  it("does not import CLI or core modules directly", async () => {
    const files = [
      "bridge-client.ts",
      "main.ts",
      "view.ts"
    ];

    for (const file of files) {
      const source = await readFile(join(shellSrcRoot, file), "utf8");

      expect(source).not.toMatch(/interfaces\/cli/);
      expect(source).not.toMatch(/\.\.\/\.\.\/\.\.\/src\/app/);
      expect(source).not.toMatch(/\.\.\/\.\.\/\.\.\/src\/config/);
      expect(source).not.toMatch(/\.\.\/\.\.\/\.\.\/src\/storage/);
      expect(source).not.toMatch(/\.\.\/\.\.\/\.\.\/src\/indexing/);
    }
  });
});
