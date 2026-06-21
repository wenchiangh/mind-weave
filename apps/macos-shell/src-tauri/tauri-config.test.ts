import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
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

  it("contains the generated icon source expected by Tauri context generation", async () => {
    await expect(access(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", "icon.png")
    )).resolves.toBeUndefined();
  });

  it("keeps source SVG assets for app and tray icons", async () => {
    for (const fileName of [
      "mindweave-app-icon.svg",
      "mindweave-tray-template.svg",
      "mindweave-tray-template-dark.svg"
    ]) {
      const source = await readFile(
        join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", fileName),
        "utf8"
      );

      expect(source).toContain("<svg");
      expect(source).toContain("MindWeave");
    }
  });

  it("contains valid template tray PNG icons", async () => {
    for (const fileName of ["tray-template.png", "tray-template-dark.png"]) {
      const icon = await readFile(
        join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", fileName)
      );
      const png = parsePng(icon);

      expect(png.width).toBe(32);
      expect(png.height).toBe(32);
      expect(png.bitDepth).toBe(8);
      expect(png.colorType).toBe(6);
    }
  });

  it("contains raw RGBA tray icon bytes for dependency-free Rust embedding", async () => {
    for (const fileName of ["tray-template.rgba", "tray-template-dark.rgba"]) {
      const bytes = await readFile(
        join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", fileName)
      );

      expect(bytes).toHaveLength(32 * 32 * 4);
    }
  });

  it("contains a valid 32x32 RGBA PNG icon for Tauri runtime", async () => {
    const icon = await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", "32x32.png")
    );
    const png = parsePng(icon);

    expect(png.width).toBe(32);
    expect(png.height).toBe(32);
    expect(png.bitDepth).toBe(8);
    expect(png.colorType).toBe(6);
    expect(inflateSync(Buffer.concat(png.idatChunks))).toHaveLength((32 * 4 + 1) * 32);
  });

  it("defines a hidden utility panel window for the menu bar shell", async () => {
    const config = JSON.parse(await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      readonly app?: {
        readonly windows?: ReadonlyArray<{
          readonly label?: string;
          readonly visible?: boolean;
          readonly decorations?: boolean;
          readonly resizable?: boolean;
          readonly alwaysOnTop?: boolean;
          readonly skipTaskbar?: boolean;
          readonly shadow?: boolean;
          readonly transparent?: boolean;
        }>;
      };
    };

    expect(config.app?.windows?.[0]).toMatchObject({
      label: "main",
      visible: false,
      decorations: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      shadow: true
    });
    expect(config.app?.windows?.[0]?.transparent).toBeUndefined();
  });

  it("configures a macOS bundle icon resource", async () => {
    const config = JSON.parse(await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      readonly bundle?: {
        readonly icon?: readonly string[];
      };
    };

    expect(config.bundle?.icon).toContain("icons/icon.icns");
    await expect(access(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "icons", "icon.icns")
    )).resolves.toBeUndefined();
  });

  it("uses a macOS plist override that keeps the shell on the AppKit app path", async () => {
    const config = JSON.parse(await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      readonly bundle?: {
        readonly macOS?: {
          readonly infoPlist?: string;
        };
      };
    };

    expect(config.bundle?.macOS?.infoPlist).toBe("Info.plist");

    const plist = await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "Info.plist"),
      "utf8"
    );
    expect(plist).toContain("<key>LSRequiresCarbon</key>");
    expect(plist).toContain("<false/>");
  });
});

function parsePng(buffer: Buffer): {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly idatChunks: readonly Buffer[];
} {
  let offset = 8;
  const idatChunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    }

    if (type === "IDAT") {
      idatChunks.push(data);
    }

    offset += 12 + length;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    idatChunks
  };
}
