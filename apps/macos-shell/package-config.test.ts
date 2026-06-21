import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("macOS shell package scripts", () => {
  it("runs the Vite dev server on the Tauri dev URL port", async () => {
    const packageJson = JSON.parse(await readFile(
      join(process.cwd(), "apps", "macos-shell", "package.json"),
      "utf8"
    )) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toContain("--host 127.0.0.1");
    expect(packageJson.scripts?.dev).toContain("--port 1420");
  });
});
