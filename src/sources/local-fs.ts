import { lstat, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  SourceCandidate,
  SourceDefinition,
  SourceInspectionResult,
  SourceInspector,
  SourceProvider,
  SourceScanResult
} from "./contracts.js";
import { SourceError } from "./errors.js";

const supportedMarkdownExtensions = new Set([".md", ".markdown"]);
const ignoredNames = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".DS_Store"
]);

type LocalFsSourceMetadata = {
  readonly rootPath: string;
  readonly excludePatterns: readonly string[];
};

type LocalFsCollection = {
  readonly candidates: SourceCandidate[];
  readonly skipped: MutableSkippedCounts;
  readonly excludedPaths: string[];
};

type MutableSkippedCounts = {
  excluded: number;
  ignored: number;
  unsupported: number;
  symlink: number;
};

export class LocalFsSourceProvider implements SourceProvider, SourceInspector {
  async scan(source: SourceDefinition): Promise<SourceScanResult> {
    const inspection = await this.inspect(source);

    return {
      sourceId: source.id,
      scannedAt: inspection.inspectedAt,
      candidates: inspection.includedCandidates
    };
  }

  async inspect(source: SourceDefinition): Promise<SourceInspectionResult> {
    if (source.type !== "local-fs") {
      throw new SourceError({
        code: "SOURCE_UNSUPPORTED_TYPE",
        sourceId: source.id,
        message: `Unsupported source type for LocalFsSourceProvider: ${source.type}.`
      });
    }

    const metadata = extractMetadata(source);
    const excludeRegexes = compileExcludeRegexes(source, metadata.excludePatterns);

    await assertRootDirectory(source, metadata.rootPath);

    const collection = await this.collectCandidates(
      source,
      metadata.rootPath,
      metadata.rootPath,
      excludeRegexes
    );
    const candidates = collection.candidates.sort((left, right) =>
      (left.relativePath ?? "").localeCompare(right.relativePath ?? "")
    );
    const excludedPaths = collection.excludedPaths.sort((left, right) =>
      left.localeCompare(right)
    );

    return {
      sourceId: source.id,
      inspectedAt: Date.now(),
      rootUri: source.rootUri,
      includedCandidates: candidates,
      skipped: collection.skipped,
      topLevelPathCounts: countTopLevelPaths(candidates),
      sampleIncludedPaths: candidates
        .map((candidate) => candidate.relativePath)
        .filter((relativePath): relativePath is string => relativePath !== undefined)
        .slice(0, 20),
      sampleExcludedPaths: excludedPaths.slice(0, 20)
    };
  }

  private async collectCandidates(
    source: SourceDefinition,
    rootPath: string,
    currentPath: string,
    excludeRegexes: readonly RegExp[]
  ): Promise<LocalFsCollection> {
    let entries;
    try {
      entries = await readdir(currentPath, {
        withFileTypes: true
      });
    } catch (error) {
      throw new SourceError({
        code: "SOURCE_SCAN_FAILED",
        sourceId: source.id,
        path: currentPath,
        message: `Unable to read source directory: ${currentPath}`,
        cause: error
      });
    }

    const collection: LocalFsCollection = {
      candidates: [],
      skipped: {
        excluded: 0,
        ignored: 0,
        unsupported: 0,
        symlink: 0
      },
      excludedPaths: []
    };

    for (const entry of entries) {
      if (shouldIgnoreName(entry.name)) {
        collection.skipped.ignored += 1;
        continue;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizeRelativePath(path.relative(rootPath, absolutePath));

      if (matchesExclude(relativePath, excludeRegexes)) {
        collection.skipped.excluded += 1;
        collection.excludedPaths.push(relativePath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        collection.skipped.symlink += 1;
        continue;
      }

      if (entry.isDirectory()) {
        mergeCollection(
          collection,
          await this.collectCandidates(source, rootPath, absolutePath, excludeRegexes)
        );
        continue;
      }

      if (!entry.isFile() || !isSupportedMarkdownPath(entry.name)) {
        collection.skipped.unsupported += 1;
        continue;
      }

      const fileStat = await stat(absolutePath);
      collection.candidates.push({
        sourceId: source.id,
        uri: pathToFileURL(absolutePath).href,
        relativePath,
        fileType: "markdown",
        updatedAt: fileStat.mtimeMs,
        size: fileStat.size
      });
    }

    return collection;
  }
}

function mergeCollection(
  target: LocalFsCollection,
  source: LocalFsCollection
): void {
  target.candidates.push(...source.candidates);
  target.excludedPaths.push(...source.excludedPaths);
  target.skipped.excluded += source.skipped.excluded;
  target.skipped.ignored += source.skipped.ignored;
  target.skipped.unsupported += source.skipped.unsupported;
  target.skipped.symlink += source.skipped.symlink;
}

function countTopLevelPaths(
  candidates: readonly SourceCandidate[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const candidate of candidates) {
    const relativePath = candidate.relativePath ?? candidate.uri;
    const [topLevelPath] = relativePath.split("/");
    if (topLevelPath === undefined || topLevelPath.length === 0) {
      continue;
    }

    counts[topLevelPath] = (counts[topLevelPath] ?? 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function extractMetadata(source: SourceDefinition): LocalFsSourceMetadata {
  const rootPath = source.metadata?.["rootPath"];

  if (typeof rootPath !== "string" || rootPath.length === 0) {
    throw new SourceError({
      code: "SOURCE_ROOT_MISSING",
      sourceId: source.id,
      message: "Local filesystem source is missing metadata.rootPath."
    });
  }

  const excludePatterns = source.metadata?.["excludePatterns"];

  if (excludePatterns === undefined) {
    return {
      rootPath,
      excludePatterns: []
    };
  }

  if (!Array.isArray(excludePatterns) || !excludePatterns.every((value) =>
    typeof value === "string"
  )) {
    throw new SourceError({
      code: "SOURCE_ROOT_INVALID",
      sourceId: source.id,
      path: rootPath,
      message: "Local filesystem source metadata.excludePatterns must be an array of strings."
    });
  }

  return {
    rootPath,
    excludePatterns
  };
}

function compileExcludeRegexes(
  source: SourceDefinition,
  patterns: readonly string[]
): readonly RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch (error) {
      throw new SourceError({
        code: "SOURCE_ROOT_INVALID",
        sourceId: source.id,
        message: `Invalid source exclude regex pattern: ${pattern}`,
        cause: error
      });
    }
  });
}

async function assertRootDirectory(
  source: SourceDefinition,
  rootPath: string
): Promise<void> {
  let rootStat;
  try {
    rootStat = await lstat(rootPath);
  } catch (error) {
    throw new SourceError({
      code: "SOURCE_ROOT_INVALID",
      sourceId: source.id,
      path: rootPath,
      message: `Local filesystem source root does not exist: ${rootPath}`,
      cause: error
    });
  }

  if (!rootStat.isDirectory()) {
    throw new SourceError({
      code: "SOURCE_ROOT_INVALID",
      sourceId: source.id,
      path: rootPath,
      message: `Local filesystem source root is not a directory: ${rootPath}`
    });
  }
}

function shouldIgnoreName(name: string): boolean {
  return ignoredNames.has(name) || name.startsWith(".");
}

function isSupportedMarkdownPath(filePath: string): boolean {
  return supportedMarkdownExtensions.has(path.extname(filePath).toLowerCase());
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function matchesExclude(
  relativePath: string,
  excludeRegexes: readonly RegExp[]
): boolean {
  return excludeRegexes.some((regex) => regex.test(relativePath));
}

export function localFilePathToUri(filePath: string): string {
  return pathToFileURL(filePath).href;
}

export function localFileUriToPath(uri: string): string {
  return fileURLToPath(uri);
}
