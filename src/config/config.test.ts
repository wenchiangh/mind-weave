import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadEffectiveConfigFile } from "./config.js";
import { isConfigError } from "./errors.js";

describe("loadEffectiveConfigFile", () => {
  it("loads a JSONC file into a deterministic effective config", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-config-"));
    const configPath = path.join(directory, "mind-weave.jsonc");
    const notesPath = path.join(directory, "notes");

    await writeFile(configPath, `{
      // comments and trailing commas are valid user config syntax
      "sources": [
        {
          "type": "local-fs",
          "rootPath": "./notes",
          "exclude": ["(^|/)drafts/"],
        },
      ],
      "embedding": {
        "provider": "openai-compatible",
        "model": "text-embedding-3-small",
        "baseUrl": "https://api.openai.com/v1",
        "apiKeyEnv": "OPENAI_API_KEY",
      },
      "storage": {
        "type": "sqlite",
        "path": "./mind-weave.sqlite",
      },
    }`, "utf8");

    const effective = await loadEffectiveConfigFile(configPath);

    expect(effective.sources[0]).toMatchObject({
      type: "local-fs",
      rootPath: notesPath,
      rootUri: pathToFileURL(notesPath).href,
      name: "notes",
      excludePatterns: ["(^|/)drafts/"]
    });
    expect(effective.sources[0]?.id).toMatch(/^source_[a-f0-9]{16}$/);
    expect(effective.sourceDefinitions[0]).toEqual(
      effective.sources[0]?.sourceDefinition
    );
    expect(effective.mcp).toEqual({
      enabled: true
    });
  });

  it("returns structured errors for invalid config files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-config-"));
    const configPath = path.join(directory, "mind-weave.jsonc");

    await writeFile(configPath, `{
      "sources": [
        { "type": "local-fs", "rootPath": "./notes" },
        { "type": "local-fs", "rootPath": "./notes/projects" },
      ],
      "embedding": {
        "provider": "openai-compatible",
        "model": "text-embedding-3-small",
        "baseUrl": "https://api.openai.com/v1",
        "apiKeyEnv": "OPENAI_API_KEY"
      },
      "storage": {
        "type": "sqlite",
        "path": "./mind-weave.sqlite"
      }
    }`, "utf8");

    await expect(loadEffectiveConfigFile(configPath)).rejects.toMatchObject({
      code: "CONFIG_NESTED_SOURCES",
      issues: [
        {
          code: "CONFIG_NESTED_SOURCES",
          path: "sources.0,sources.1"
        }
      ]
    });
  });

  it("uses the same structured error class for callers", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-config-"));
    const configPath = path.join(directory, "mind-weave.jsonc");

    await writeFile(configPath, "{", "utf8");

    await loadEffectiveConfigFile(configPath).catch((error: unknown) => {
      expect(isConfigError(error)).toBe(true);
    });
  });
});
