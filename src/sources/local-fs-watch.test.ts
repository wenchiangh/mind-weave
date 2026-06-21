import { mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SourceDefinition, SourceFileEvent } from "./contracts.js";
import {
  LocalFsSourceWatcher,
  normalizeLocalFsWatchEvent
} from "./local-fs-watch.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "mind-weave-watch-"));
}

function createSource(rootPath: string): SourceDefinition {
  return {
    id: "source_a",
    type: "local-fs",
    name: "Vault",
    rootUri: pathToFileURL(rootPath).href,
    status: "active",
    metadata: {
      rootPath,
      excludePatterns: ["excluded"]
    }
  };
}

describe("normalizeLocalFsWatchEvent", () => {
  it("normalizes Markdown create and change events into upsert source events", async () => {
    const rootPath = await createTempRoot();
    const filePath = path.join(rootPath, "notes", "entry.md");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "# Entry\n");

    const event = await normalizeLocalFsWatchEvent(createSource(rootPath), {
      absolutePath: filePath,
      kind: "change"
    });

    expect(event).toMatchObject({
      type: "upsert",
      candidate: {
        sourceId: "source_a",
        uri: pathToFileURL(filePath).href,
        relativePath: "notes/entry.md",
        fileType: "markdown",
        size: 8
      }
    });
    expect(event?.type === "upsert" ? event.candidate.updatedAt : undefined)
      .toEqual(expect.any(Number));
  });

  it("normalizes missing Markdown paths into delete source events", async () => {
    const rootPath = await createTempRoot();
    const filePath = path.join(rootPath, "missing.md");

    await expect(normalizeLocalFsWatchEvent(createSource(rootPath), {
      absolutePath: filePath,
      kind: "delete"
    })).resolves.toEqual({
      type: "delete",
      target: {
        sourceId: "source_a",
        uri: pathToFileURL(filePath).href,
        relativePath: "missing.md",
        fileType: "markdown"
      }
    });
  });

  it("ignores unsupported, hidden, excluded, directory, and symlink paths", async () => {
    const rootPath = await createTempRoot();
    const source = createSource(rootPath);
    const unsupported = path.join(rootPath, "note.txt");
    const hidden = path.join(rootPath, ".hidden.md");
    const excluded = path.join(rootPath, "excluded-note.md");
    const directory = path.join(rootPath, "folder.md");
    const realFile = path.join(rootPath, "real.md");
    const link = path.join(rootPath, "link.md");
    await writeFile(unsupported, "text");
    await writeFile(hidden, "# Hidden");
    await writeFile(excluded, "# Excluded");
    await mkdir(directory);
    await writeFile(realFile, "# Real");
    await symlink(realFile, link);

    for (const absolutePath of [unsupported, hidden, excluded, directory, link]) {
      await expect(normalizeLocalFsWatchEvent(source, {
        absolutePath,
        kind: "change"
      })).resolves.toBeNull();
    }
  });
});

describe("LocalFsSourceWatcher", () => {
  it("normalizes watcher callbacks and exposes source file events", async () => {
    const rootPath = await createTempRoot();
    const filePath = path.join(rootPath, "note.md");
    await writeFile(filePath, "# Note\n");
    let listener: ((eventType: "rename" | "change", fileName: string) => void) | undefined;
    let closed = false;
    const events: SourceFileEvent[] = [];
    let resolveEvent: (() => void) | undefined;
    const eventReceived = new Promise<void>((resolve) => {
      resolveEvent = resolve;
    });
    const watcher = new LocalFsSourceWatcher({
      source: createSource(rootPath),
      onEvent: async (event) => {
        events.push(event);
        resolveEvent?.();
      },
      watch: (_rootPath, _options, callback) => {
        listener = callback;
        return {
          close: () => {
            closed = true;
          }
        };
      }
    });

    await watcher.start();
    listener?.("change", "note.md");
    await eventReceived;
    await watcher.stop();

    expect(events).toMatchObject([
      {
        type: "upsert",
        candidate: {
          sourceId: "source_a",
          relativePath: "note.md"
        }
      }
    ]);
    expect(closed).toBe(true);
  });

  it("surfaces watcher startup errors through onError", async () => {
    const rootPath = await createTempRoot();
    const errors: unknown[] = [];
    const watcher = new LocalFsSourceWatcher({
      source: createSource(rootPath),
      onEvent: async () => {},
      onError: (error) => {
        errors.push(error);
      },
      watch: () => {
        throw new Error("watch failed");
      }
    });

    await expect(watcher.start()).rejects.toThrow("watch failed");
    expect(errors).toHaveLength(1);
  });
});
