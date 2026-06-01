import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isConfigError } from "./errors.js";
import { loadConfigFile, parseConfigText } from "./load.js";

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected function to throw.");
}

describe("parseConfigText", () => {
  it("accepts JSONC comments and trailing commas", () => {
    expect(parseConfigText(`{
      // local source
      "sources": [
        { "type": "local-fs", "rootPath": "./notes", },
      ],
    }`)).toEqual({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes"
        }
      ]
    });
  });

  it("returns a structured parse error for invalid JSONC", () => {
    const error = captureError(() => parseConfigText("{"));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_JSONC_PARSE_FAILED");
      expect(error.issues[0]?.path).toBe("offset:1");
    }
  });
});

describe("loadConfigFile", () => {
  it("loads JSONC from disk and reports the config file base directory", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-config-"));
    const configPath = path.join(directory, "mind-weave.jsonc");
    await writeFile(configPath, "{ \"sources\": [] }", "utf8");

    await expect(loadConfigFile(configPath)).resolves.toEqual({
      filePath: configPath,
      baseDir: directory,
      data: {
        sources: []
      }
    });
  });

  it("returns a structured read error for missing files", async () => {
    await expect(loadConfigFile("/definitely/missing/mind-weave.jsonc"))
      .rejects.toMatchObject({
        code: "CONFIG_FILE_READ_FAILED",
        path: "/definitely/missing/mind-weave.jsonc"
      });
  });
});
