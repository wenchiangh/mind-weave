import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  EffectiveConfig,
  EffectiveConfigOptions,
  EffectiveLocalFsSourceConfig,
  UserConfig
} from "./contracts.js";
import { ConfigError, type ConfigErrorIssue } from "./errors.js";

export function createEffectiveConfig(
  userConfig: UserConfig,
  options: EffectiveConfigOptions
): EffectiveConfig {
  const sources = userConfig.sources.map((source) =>
    createEffectiveLocalFsSource(source, options)
  );

  assertNoNestedSources(sources);

  return {
    sources,
    sourceDefinitions: sources.map((source) => source.sourceDefinition),
    embedding: userConfig.embedding,
    storage: userConfig.storage,
    mcp: {
      enabled: userConfig.mcp?.enabled ?? true
    }
  };
}

function createEffectiveLocalFsSource(
  source: UserConfig["sources"][number],
  options: EffectiveConfigOptions
): EffectiveLocalFsSourceConfig {
  const rootPath = normalizeRootPath(source.rootPath, options.baseDir);
  const rootUri = pathToFileURL(rootPath).href;
  const id = source.id ?? generateSourceId(rootPath);
  const name = source.name ?? (path.basename(rootPath) || id);
  const excludePatterns = source.exclude ?? [];
  const excludeRegexes = compileExcludeRegexes(excludePatterns);

  return {
    type: "local-fs",
    id,
    name,
    rootPath,
    rootUri,
    excludePatterns,
    excludeRegexes,
    sourceDefinition: {
      id,
      type: "local-fs",
      name,
      rootUri,
      status: "active",
      metadata: {
        rootPath,
        excludePatterns
      }
    }
  };
}

function normalizeRootPath(rootPath: string, baseDir: string): string {
  const resolvedPath = path.isAbsolute(rootPath)
    ? rootPath
    : path.resolve(baseDir, rootPath);

  return path.normalize(resolvedPath);
}

function generateSourceId(rootPath: string): string {
  const hash = crypto.createHash("sha256").update(rootPath).digest("hex");
  return `source_${hash.slice(0, 16)}`;
}

function compileExcludeRegexes(patterns: readonly string[]): readonly RegExp[] {
  return patterns.map((pattern, index) => {
    try {
      return new RegExp(pattern);
    } catch (error) {
      throw new ConfigError({
        code: "CONFIG_REGEX_INVALID",
        message: `Invalid exclude regex pattern at sources.*.exclude.${index}.`,
        path: `sources.*.exclude.${index}`,
        cause: error
      });
    }
  });
}

function assertNoNestedSources(
  sources: readonly EffectiveLocalFsSourceConfig[]
): void {
  const issues: ConfigErrorIssue[] = [];

  for (let leftIndex = 0; leftIndex < sources.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sources.length; rightIndex += 1) {
      const left = sources[leftIndex];
      const right = sources[rightIndex];

      if (left === undefined || right === undefined) {
        continue;
      }

      if (areSameOrNested(left.rootPath, right.rootPath)) {
        issues.push({
          code: "CONFIG_NESTED_SOURCES",
          message: `Local filesystem source roots must not duplicate or contain each other: ${left.rootPath} and ${right.rootPath}.`,
          path: `sources.${leftIndex},sources.${rightIndex}`
        });
      }
    }
  }

  if (issues.length > 0) {
    throw new ConfigError({
      code: "CONFIG_NESTED_SOURCES",
      message: "Config contains duplicate or nested local filesystem sources.",
      issues
    });
  }
}

function areSameOrNested(leftPath: string, rightPath: string): boolean {
  const relative = path.relative(leftPath, rightPath);
  if (relative === "") {
    return true;
  }

  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return true;
  }

  const reverseRelative = path.relative(rightPath, leftPath);
  return reverseRelative !== ""
    && !reverseRelative.startsWith("..")
    && !path.isAbsolute(reverseRelative);
}
