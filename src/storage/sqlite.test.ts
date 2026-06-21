import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type {
  StoredChunk,
  StoredDocument,
  StoredEmbedding,
  StoredSource
} from "./contracts.js";
import { isStorageError } from "./errors.js";
import { SQLiteStorage } from "./sqlite.js";

async function createDatabasePath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-storage-"));
  return path.join(directory, "mind-weave.sqlite");
}

function createSource(sourceId = "source_a"): StoredSource {
  return {
    sourceId,
    name: `Source ${sourceId}`,
    type: "local-fs",
    rootUri: `file:///tmp/${sourceId}`,
    status: "active",
    lastScannedAt: 1000
  };
}

function createDocument(documentId = "doc_a"): StoredDocument {
  return {
    documentId,
    sourceId: "source_a",
    uri: `file:///tmp/source_a/${documentId}.md`,
    relativePath: `${documentId}.md`,
    fileType: "markdown",
    status: "indexed",
    sourceUpdatedAt: 1000,
    indexedAt: 2000,
    metadata: {
      fingerprint: "mtime-size"
    }
  };
}

function createChunk(index: number, text = `chunk ${index}`): StoredChunk {
  return {
    chunkId: `chunk_${index}`,
    documentId: "doc_a",
    sourceId: "source_a",
    index,
    text,
    contentHash: `hash_${index}`
  };
}

function createEmbedding(chunkId: string, index: number): StoredEmbedding {
  return {
    embeddingId: `embedding_${index}`,
    chunkId,
    provider: "openai-compatible",
    model: "text-embedding-3-small",
    dimensions: 1536
  };
}

async function captureError(action: () => unknown): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

describe("SQLiteStorage", () => {
  it("creates schema on first open and reopens compatible schema", async () => {
    const databasePath = await createDatabasePath();
    const storage = new SQLiteStorage(databasePath);
    storage.close();

    expect(() => new SQLiteStorage(databasePath).close()).not.toThrow();
  });

  it("fails clearly on incompatible schema marker", async () => {
    const databasePath = await createDatabasePath();
    const db = new Database(databasePath);
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO meta (key, value) VALUES ('schema_version', '999');
    `);
    db.close();

    const error = await captureError(() => new SQLiteStorage(databasePath));

    expect(isStorageError(error)).toBe(true);
    if (isStorageError(error)) {
      expect(error.code).toBe("STORAGE_SCHEMA_INCOMPATIBLE");
      expect(error.databasePath).toBe(databasePath);
    }
  });

  it("saves and rebuilds source mirror", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());

    await storage.saveSources([createSource("source_a"), createSource("source_b")]);
    await expect(storage.listSources()).resolves.toEqual([
      createSource("source_a"),
      createSource("source_b")
    ]);

    await storage.saveSources([createSource("source_b")]);
    await expect(storage.listSources()).resolves.toEqual([
      createSource("source_b")
    ]);

    storage.close();
  });

  it("upserts documents and excludes soft-deleted documents from active listing", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());
    await storage.upsertDocument(createDocument("doc_a"));
    await storage.upsertDocument({
      ...createDocument("doc_b"),
      status: "stale"
    });

    await expect(storage.listActiveDocuments("source_a")).resolves.toMatchObject([
      {
        documentId: "doc_a",
        metadata: {
          fingerprint: "mtime-size"
        }
      },
      {
        documentId: "doc_b",
        status: "stale"
      }
    ]);

    await storage.markDocumentDeleted("doc_a", 3000);
    await expect(storage.listActiveDocuments("source_a")).resolves.toMatchObject([
      {
        documentId: "doc_b"
      }
    ]);

    storage.close();
  });

  it("transactionally replaces chunks and embedding metadata for a document", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());
    await storage.upsertDocument(createDocument("doc_a"));

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(0),
      createChunk(1)
    ], [
      createEmbedding("chunk_0", 0),
      createEmbedding("chunk_1", 1)
    ]);
    expect(storage.countRows("chunks")).toBe(2);
    expect(storage.countRows("embeddings")).toBe(2);

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(2, "replacement")
    ], [
      createEmbedding("chunk_2", 2)
    ]);
    expect(storage.countRows("chunks")).toBe(1);
    expect(storage.countRows("embeddings")).toBe(1);

    storage.close();
  });

  it("persists index config metadata", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());

    await expect(storage.readIndexConfig()).resolves.toBeNull();

    await storage.writeIndexConfig({
      provider: "openai-compatible",
      model: "text-embedding-3-small",
      dimensions: 1536
    });

    await expect(storage.readIndexConfig()).resolves.toEqual({
      provider: "openai-compatible",
      model: "text-embedding-3-small",
      dimensions: 1536
    });

    storage.close();
  });
});
