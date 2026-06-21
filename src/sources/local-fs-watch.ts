import { watch as nodeWatch } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  SourceDefinition,
  SourceFileEvent,
  SourceWatcher,
  SourceWatchEventInput
} from "./contracts.js";

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

export type LocalFsWatchCallback = (
  eventType: "rename" | "change",
  fileName: string
) => void;

export type LocalFsWatchHandle = {
  close(): void;
};

export type LocalFsWatchFunction = (
  rootPath: string,
  options: { readonly recursive: boolean },
  callback: LocalFsWatchCallback
) => LocalFsWatchHandle;

export type LocalFsSourceWatcherOptions = {
  readonly source: SourceDefinition;
  readonly onEvent: (event: SourceFileEvent) => Promise<void> | void;
  readonly onError?: ((error: unknown) => void) | undefined;
  readonly watch?: LocalFsWatchFunction | undefined;
};

export class LocalFsSourceWatcher implements SourceWatcher {
  private readonly source: SourceDefinition;
  private readonly onEvent: (event: SourceFileEvent) => Promise<void> | void;
  private readonly onError: ((error: unknown) => void) | undefined;
  private readonly watch: LocalFsWatchFunction;
  private handle: LocalFsWatchHandle | undefined;

  constructor(options: LocalFsSourceWatcherOptions) {
    this.source = options.source;
    this.onEvent = options.onEvent;
    this.onError = options.onError;
    this.watch = options.watch ?? defaultWatch;
  }

  async start(): Promise<void> {
    const metadata = extractMetadata(this.source);
    try {
      this.handle = this.watch(metadata.rootPath, { recursive: true }, (eventType, fileName) => {
        if (fileName.length === 0) {
          return;
        }

        void this.handleWatchEvent(eventType, path.join(metadata.rootPath, fileName));
      });
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.handle?.close();
    this.handle = undefined;
  }

  private async handleWatchEvent(
    eventType: "rename" | "change",
    absolutePath: string
  ): Promise<void> {
    try {
      const event = await normalizeLocalFsWatchEvent(this.source, {
        absolutePath,
        kind: eventType === "change" ? "change" : "change"
      });
      if (event !== null) {
        await this.onEvent(event);
      }
    } catch (error) {
      this.onError?.(error);
    }
  }
}

export async function normalizeLocalFsWatchEvent(
  source: SourceDefinition,
  input: SourceWatchEventInput
): Promise<SourceFileEvent | null> {
  if (source.type !== "local-fs") {
    return null;
  }

  const metadata = extractMetadata(source);
  const relativePath = normalizeRelativePath(path.relative(metadata.rootPath, input.absolutePath));

  if (
    relativePath.startsWith("../")
    || relativePath === ".."
    || path.isAbsolute(relativePath)
    || shouldIgnoreRelativePath(relativePath)
    || !isSupportedMarkdownPath(relativePath)
    || matchesExclude(relativePath, compileExcludeRegexes(metadata.excludePatterns))
  ) {
    return null;
  }

  const uri = pathToFileURL(input.absolutePath).href;

  if (input.kind === "delete") {
    return {
      type: "delete",
      target: {
        sourceId: source.id,
        uri,
        relativePath,
        fileType: "markdown"
      }
    };
  }

  let itemStat;
  try {
    const itemLstat = await lstat(input.absolutePath);
    if (itemLstat.isSymbolicLink() || !itemLstat.isFile()) {
      return null;
    }
    itemStat = await stat(input.absolutePath);
  } catch {
    return {
      type: "delete",
      target: {
        sourceId: source.id,
        uri,
        relativePath,
        fileType: "markdown"
      }
    };
  }

  return {
    type: "upsert",
    candidate: {
      sourceId: source.id,
      uri,
      relativePath,
      fileType: "markdown",
      updatedAt: itemStat.mtimeMs,
      size: itemStat.size
    }
  };
}

function extractMetadata(source: SourceDefinition): LocalFsSourceMetadata {
  const rootPath = source.metadata?.["rootPath"];
  const excludePatterns = source.metadata?.["excludePatterns"];

  return {
    rootPath: typeof rootPath === "string" ? rootPath : fileURLToPath(source.rootUri),
    excludePatterns: Array.isArray(excludePatterns)
      ? excludePatterns.filter((pattern): pattern is string => typeof pattern === "string")
      : []
  };
}

function compileExcludeRegexes(patterns: readonly string[]): readonly RegExp[] {
  return patterns.map((pattern) => new RegExp(pattern));
}

function shouldIgnoreRelativePath(relativePath: string): boolean {
  return relativePath.split("/").some((part) =>
    ignoredNames.has(part) || part.startsWith(".")
  );
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

const defaultWatch: LocalFsWatchFunction = (rootPath, options, callback) => {
  const watcher = nodeWatch(rootPath, options, (eventType, fileName) => {
    if (eventType !== "rename" && eventType !== "change") {
      return;
    }

    if (typeof fileName !== "string") {
      return;
    }

    callback(eventType, fileName);
  });

  return {
    close: () => watcher.close()
  };
};
