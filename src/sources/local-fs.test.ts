import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { SourceDefinition } from "./contracts.js";
import { isSourceError } from "./errors.js";
import { LocalFsSourceProvider } from "./local-fs.js";

async function createFixtureDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "mind-weave-source-"));
}

function createSource(rootPath: string): SourceDefinition {
  return {
    id: "notes",
    type: "local-fs",
    name: "Notes",
    rootUri: pathToFileURL(rootPath).href,
    status: "active",
    metadata: {
      rootPath,
      excludePatterns: []
    }
  };
}

async function writeFixtureFile(
  rootPath: string,
  relativePath: string,
  content = "content"
): Promise<void> {
  const filePath = path.join(rootPath, relativePath);
  await mkdir(path.dirname(filePath), {
    recursive: true
  });
  await writeFile(filePath, content, "utf8");
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

describe("LocalFsSourceProvider", () => {
  it("returns deterministic Markdown candidates with filesystem metadata", async () => {
    const rootPath = await createFixtureDirectory();
    await writeFixtureFile(rootPath, "z-last.md", "last");
    await writeFixtureFile(rootPath, "a-first.markdown", "first");
    await writeFixtureFile(rootPath, "nested/middle.md", "middle");
    await writeFixtureFile(rootPath, "nested/ignore.txt", "ignore");

    const result = await new LocalFsSourceProvider().scan(createSource(rootPath));

    expect(result.sourceId).toBe("notes");
    expect(result.scannedAt).toEqual(expect.any(Number));
    expect(result.candidates.map((candidate) => candidate.relativePath)).toEqual([
      "a-first.markdown",
      "nested/middle.md",
      "z-last.md"
    ]);
    expect(result.candidates[0]).toMatchObject({
      sourceId: "notes",
      uri: pathToFileURL(path.join(rootPath, "a-first.markdown")).href,
      relativePath: "a-first.markdown",
      fileType: "markdown",
      size: 5
    });
    expect(result.candidates[0]?.updatedAt).toEqual(expect.any(Number));
  });

  it("ignores hidden paths and default ignored directories or files", async () => {
    const rootPath = await createFixtureDirectory();
    await writeFixtureFile(rootPath, "visible.md");
    await writeFixtureFile(rootPath, ".hidden.md");
    await writeFixtureFile(rootPath, ".hidden-dir/file.md");
    await writeFixtureFile(rootPath, ".git/config.md");
    await writeFixtureFile(rootPath, "node_modules/package.md");
    await writeFixtureFile(rootPath, "dist/output.md");
    await writeFixtureFile(rootPath, "build/output.md");
    await writeFixtureFile(rootPath, ".DS_Store");

    const result = await new LocalFsSourceProvider().scan(createSource(rootPath));

    expect(result.candidates.map((candidate) => candidate.relativePath)).toEqual([
      "visible.md"
    ]);
  });

  it("honors user exclude regex patterns against normalized relative paths", async () => {
    const rootPath = await createFixtureDirectory();
    await writeFixtureFile(rootPath, "keep.md");
    await writeFixtureFile(rootPath, "drafts/remove.md");
    await writeFixtureFile(rootPath, "archive/remove.markdown");
    const source = {
      ...createSource(rootPath),
      metadata: {
        rootPath,
        excludePatterns: ["(^|/)drafts/", "^archive/"]
      }
    };

    const result = await new LocalFsSourceProvider().scan(source);

    expect(result.candidates.map((candidate) => candidate.relativePath)).toEqual([
      "keep.md"
    ]);
  });

  it("inspects included and excluded paths without losing source scan behavior", async () => {
    const rootPath = await createFixtureDirectory();
    await writeFixtureFile(rootPath, "keep.md");
    await writeFixtureFile(rootPath, "nested/keep.markdown");
    await writeFixtureFile(rootPath, "drafts/remove.md");
    await writeFixtureFile(rootPath, "archive/remove.md");
    await writeFixtureFile(rootPath, "image.png");
    await writeFixtureFile(rootPath, ".hidden.md");
    const source = {
      ...createSource(rootPath),
      metadata: {
        rootPath,
        excludePatterns: ["(^|/)drafts/", "^archive/"]
      }
    };

    const result = await new LocalFsSourceProvider().inspect(source);

    expect(result.sourceId).toBe("notes");
    expect(result.includedCandidates.map((candidate) => candidate.relativePath)).toEqual([
      "keep.md",
      "nested/keep.markdown"
    ]);
    expect(result.topLevelPathCounts).toEqual({
      "keep.md": 1,
      nested: 1
    });
    expect(result.skipped).toEqual({
      excluded: 2,
      ignored: 1,
      unsupported: 1,
      symlink: 0
    });
    expect(result.sampleIncludedPaths).toEqual([
      "keep.md",
      "nested/keep.markdown"
    ]);
    expect(result.sampleExcludedPaths).toEqual([
      "archive/remove.md",
      "drafts/remove.md"
    ]);
  });

  it("does not follow symlinks", async () => {
    const rootPath = await createFixtureDirectory();
    const externalPath = await createFixtureDirectory();
    await writeFixtureFile(rootPath, "real.md");
    await writeFixtureFile(externalPath, "linked.md");
    await symlink(externalPath, path.join(rootPath, "linked-dir"));

    const result = await new LocalFsSourceProvider().scan(createSource(rootPath));

    expect(result.candidates.map((candidate) => candidate.relativePath)).toEqual([
      "real.md"
    ]);
  });

  it("returns structured errors for unsupported source type", async () => {
    const rootPath = await createFixtureDirectory();

    const error = await captureError(async () =>
      new LocalFsSourceProvider().scan({
        ...createSource(rootPath),
        type: "other"
      })
    );

    expect(isSourceError(error)).toBe(true);
    if (isSourceError(error)) {
      expect(error.code).toBe("SOURCE_UNSUPPORTED_TYPE");
      expect(error.sourceId).toBe("notes");
    }
  });

  it("returns structured errors for missing root metadata", async () => {
    const rootPath = await createFixtureDirectory();

    const error = await captureError(async () =>
      new LocalFsSourceProvider().scan({
        ...createSource(rootPath),
        metadata: {}
      })
    );

    expect(isSourceError(error)).toBe(true);
    if (isSourceError(error)) {
      expect(error.code).toBe("SOURCE_ROOT_MISSING");
    }
  });

  it("returns structured errors for missing root directories", async () => {
    const rootPath = path.join(await createFixtureDirectory(), "missing");

    const error = await captureError(async () =>
      new LocalFsSourceProvider().scan(createSource(rootPath))
    );

    expect(isSourceError(error)).toBe(true);
    if (isSourceError(error)) {
      expect(error.code).toBe("SOURCE_ROOT_INVALID");
      expect(error.path).toBe(rootPath);
    }
  });

  it("returns structured errors for invalid exclude metadata", async () => {
    const rootPath = await createFixtureDirectory();

    const error = await captureError(async () =>
      new LocalFsSourceProvider().scan({
        ...createSource(rootPath),
        metadata: {
          rootPath,
          excludePatterns: ["["]
        }
      })
    );

    expect(isSourceError(error)).toBe(true);
    if (isSourceError(error)) {
      expect(error.code).toBe("SOURCE_ROOT_INVALID");
    }
  });
});
