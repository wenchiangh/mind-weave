import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("macOS shell panel styling", () => {
  it("uses a rectangular panel surface until native rounding is implemented", async () => {
    const styles = await readFile(
      join(process.cwd(), "apps", "macos-shell", "src", "styles.css"),
      "utf8"
    );
    const panelRule = styles.match(/\.panel\s*\{[^}]*\}/)?.[0] ?? "";

    expect(styles).not.toContain("background: transparent");
    expect(panelRule).not.toContain("border-radius:");
    expect(panelRule).not.toContain("overflow: hidden");
    expect(panelRule).not.toContain("border: 1px solid rgba(0, 0, 0, 0.12)");
  });
});
