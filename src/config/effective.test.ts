import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { UserConfig } from "./contracts.js";
import { createEffectiveConfig } from "./effective.js";
import { isConfigError } from "./errors.js";

const baseDir = path.resolve("/tmp/mind-weave-config");

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected function to throw.");
}

function createUserConfig(
  overrides: Partial<UserConfig> = {}
): UserConfig {
  return {
    sources: [
      {
        type: "local-fs",
        rootPath: "./notes"
      }
    ],
    embedding: {
      provider: "openai-compatible",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY"
    },
    storage: {
      type: "sqlite",
      path: "./mind-weave.sqlite"
    },
    ...overrides
  };
}

describe("createEffectiveConfig", () => {
  it("derives defaults without scanning files or opening storage", () => {
    const effective = createEffectiveConfig(createUserConfig(), { baseDir });
    const rootPath = path.join(baseDir, "notes");
    const source = effective.sources[0];

    expect(source).toMatchObject({
      type: "local-fs",
      rootPath,
      rootUri: pathToFileURL(rootPath).href,
      name: "notes",
      excludePatterns: []
    });
    expect(source?.id).toMatch(/^source_[a-f0-9]{16}$/);
    expect(effective.mcp).toEqual({ enabled: true });
    expect(effective.storage).toEqual({
      type: "sqlite",
      path: path.join(baseDir, "mind-weave.sqlite")
    });
    expect(effective.sourceDefinitions).toEqual([
      source?.sourceDefinition
    ]);
  });

  it("preserves explicit source IDs and names", () => {
    const effective = createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          id: "personal-notes",
          name: "Personal Notes",
          rootPath: "./notes"
        }
      ]
    }), { baseDir });

    expect(effective.sources[0]).toMatchObject({
      id: "personal-notes",
      name: "Personal Notes"
    });
  });

  it("generates deterministic source IDs from normalized absolute roots", () => {
    const left = createEffectiveConfig(createUserConfig(), { baseDir });
    const right = createEffectiveConfig(createUserConfig(), { baseDir });
    const changedRoot = createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./other-notes"
        }
      ]
    }), { baseDir });

    expect(left.sources[0]?.id).toBe(right.sources[0]?.id);
    expect(left.sources[0]?.id).not.toBe(changedRoot.sources[0]?.id);
  });

  it("resolves relative source roots from the supplied base directory", () => {
    const effective = createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "../notes/"
        }
      ]
    }), { baseDir });

    expect(effective.sources[0]?.rootPath).toBe(
      path.resolve(baseDir, "../notes/")
    );
  });

  it("keeps MCP disabled when explicitly configured", () => {
    const effective = createEffectiveConfig(createUserConfig({
      mcp: {
        enabled: false
      }
    }), { baseDir });

    expect(effective.mcp).toEqual({ enabled: false });
  });

  it("validates and compiles exclude regex patterns", () => {
    const effective = createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes",
          exclude: ["(^|/)drafts/", "\\.tmp$"]
        }
      ]
    }), { baseDir });

    expect(effective.sources[0]?.excludePatterns).toEqual([
      "(^|/)drafts/",
      "\\.tmp$"
    ]);
    expect(effective.sources[0]?.excludeRegexes).toHaveLength(2);
  });

  it("rejects invalid exclude regex patterns", () => {
    const error = captureError(() => createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes",
          exclude: ["["]
        }
      ]
    }), { baseDir }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_REGEX_INVALID");
      expect(error.path).toBe("sources.*.exclude.0");
    }
  });

  it("rejects duplicate source roots", () => {
    const error = captureError(() => createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes"
        },
        {
          type: "local-fs",
          id: "other",
          rootPath: "./notes/"
        }
      ]
    }), { baseDir }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_NESTED_SOURCES");
    }
  });

  it("rejects parent and child source roots after normalization", () => {
    const error = captureError(() => createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes"
        },
        {
          type: "local-fs",
          rootPath: "./notes/projects"
        }
      ]
    }), { baseDir }));

    expect(isConfigError(error)).toBe(true);
    if (isConfigError(error)) {
      expect(error.code).toBe("CONFIG_NESTED_SOURCES");
      expect(error.issues[0]?.path).toBe("sources.0,sources.1");
    }
  });

  it("accepts sibling source roots", () => {
    expect(() => createEffectiveConfig(createUserConfig({
      sources: [
        {
          type: "local-fs",
          rootPath: "./notes"
        },
        {
          type: "local-fs",
          rootPath: "./references"
        }
      ]
    }), { baseDir })).not.toThrow();
  });
});
