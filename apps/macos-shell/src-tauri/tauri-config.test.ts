import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tauri shell configuration", () => {
  it("does not declare a packaged sidecar before a sidecar binary exists", async () => {
    const config = JSON.parse(await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      readonly bundle?: {
        readonly externalBin?: readonly string[];
      };
    };

    expect(config.bundle?.externalBin).toBeUndefined();
  });

  it("contains the default icon expected by Tauri context generation", async () => {
    await expect(access(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", "icon.png")
    )).resolves.toBeUndefined();
  });
});
