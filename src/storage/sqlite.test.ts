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

function createSource(
  sourceId = "source_a",
  status: StoredSource["status"] = "active"
): StoredSource {
  return {
    sourceId,
    name: `Source ${sourceId}`,
    type: "local-fs",
    rootUri: `file:///tmp/${sourceId}`,
    status,
    lastScannedAt: 1000
  };
}

function createDocument(
  documentId = "doc_a",
  sourceId = "source_a",
  status: StoredDocument["status"] = "indexed",
  fileType = "markdown"
): StoredDocument {
  return {
    documentId,
    sourceId,
    uri: `file:///tmp/${sourceId}/${documentId}.md`,
    relativePath: `${documentId}.md`,
    fileType,
    status,
    sourceUpdatedAt: 1000,
    indexedAt: 2000,
    metadata: {
      fingerprint: "mtime-size"
    }
  };
}

function createChunk(
  index: number,
  text = `chunk ${index}`,
  documentId = "doc_a",
  sourceId = "source_a"
): StoredChunk {
  return {
    chunkId: `${documentId}_chunk_${index}`,
    documentId,
    sourceId,
    index,
    text,
    contentHash: `hash_${index}`
  };
}

function createEmbedding(chunkId: string, index: number): StoredEmbedding {
  return {
    embeddingId: `${chunkId}_embedding_${index}`,
    chunkId,
    provider: "openai-compatible",
    model: "text-embedding-3-small",
    dimensions: 1536
  };
}

async function insertSearchFixture(storage: SQLiteStorage): Promise<void> {
  await storage.saveSources([
    createSource("source_a"),
    createSource("source_b"),
    createSource("source_disabled", "disabled")
  ]);

  const documents = [
    createDocument("doc_near", "source_a", "indexed", "markdown"),
    createDocument("doc_stale", "source_a", "stale", "markdown"),
    createDocument("doc_other_source", "source_b", "indexed", "markdown"),
    createDocument("doc_text", "source_a", "indexed", "text"),
    createDocument("doc_failed", "source_a", "failed", "markdown"),
    createDocument("doc_deleted", "source_a", "deleted", "markdown"),
    createDocument("doc_disabled_source", "source_disabled", "indexed", "markdown")
  ];

  for (const document of documents) {
    await storage.upsertDocument(document);
    const chunk = createChunk(0, document.documentId, document.documentId, document.sourceId);
    await storage.replaceDocumentChunks(document.documentId, [chunk], [
      createEmbedding(chunk.chunkId, 0)
    ]);
  }

  await storage.replaceEmbeddingVectors([
    { embeddingId: "doc_near_chunk_0_embedding_0", vector: [1, 0, 0] },
    { embeddingId: "doc_stale_chunk_0_embedding_0", vector: [0.95, 0.05, 0] },
    { embeddingId: "doc_other_source_chunk_0_embedding_0", vector: [0.8, 0.2, 0] },
    { embeddingId: "doc_text_chunk_0_embedding_0", vector: [0.7, 0.3, 0] },
    { embeddingId: "doc_failed_chunk_0_embedding_0", vector: [0.99, 0.01, 0] },
    { embeddingId: "doc_deleted_chunk_0_embedding_0", vector: [0.98, 0.02, 0] },
    { embeddingId: "doc_disabled_source_chunk_0_embedding_0", vector: [0.97, 0.03, 0] }
  ]);
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

  it("counts documents by status for runtime diagnostics", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());
    await storage.upsertDocument(createDocument("doc_indexed"));
    await storage.upsertDocument(createDocument("doc_stale", "source_a", "stale"));
    await storage.upsertDocument(createDocument("doc_failed", "source_a", "failed"));
    await storage.upsertDocument(createDocument("doc_deleted", "source_a", "deleted"));

    await expect(storage.countDocumentsByStatus()).resolves.toEqual({
      indexed: 1,
      stale: 1,
      failed: 1,
      deleted: 1
    });

    storage.close();
  });

  it("transactionally replaces chunks and embedding metadata for a document", async () => {
    const storage = new SQLiteStorage(await createDatabasePath());
    await storage.upsertDocument(createDocument("doc_a"));

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(0),
      createChunk(1)
    ], [
      createEmbedding("doc_a_chunk_0", 0),
      createEmbedding("doc_a_chunk_1", 1)
    ]);
    expect(storage.countRows("chunks")).toBe(2);
    expect(storage.countRows("embeddings")).toBe(2);

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(2, "replacement")
    ], [
      createEmbedding("doc_a_chunk_2", 2)
    ]);
    expect(storage.countRows("chunks")).toBe(1);
    expect(storage.countRows("embeddings")).toBe(1);

    storage.close();
  });

  it("stores vectors and searches nearest rows joined through active metadata", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await insertSearchFixture(storage);

    const results = await storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10
    });

    expect(results.map((result) => result.chunkId)).toEqual([
      "doc_near_chunk_0",
      "doc_stale_chunk_0",
      "doc_other_source_chunk_0",
      "doc_text_chunk_0"
    ]);
    expect(results[0]).toMatchObject({
      chunkId: "doc_near_chunk_0",
      documentId: "doc_near",
      sourceId: "source_a",
      sourceName: "Source source_a",
      uri: "file:///tmp/source_a/doc_near.md",
      text: "doc_near",
      distance: 0,
      score: 1,
      documentStatus: "indexed",
      sourceStatus: "active",
      sourceUpdatedAt: 1000,
      indexedAt: 2000
    });
    expect(results.every((result) => result.score > 0 && result.score <= 1)).toBe(true);

    storage.close();
  });

  it("applies source, file type, and score filters in vector search SQL", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await insertSearchFixture(storage);

    await expect(storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10,
      includeSourceIds: ["source_b"]
    })).resolves.toMatchObject([
      {
        chunkId: "doc_other_source_chunk_0"
      }
    ]);

    await expect(storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10,
      excludeSourceIds: ["source_a"]
    })).resolves.toMatchObject([
      {
        chunkId: "doc_other_source_chunk_0"
      }
    ]);

    await expect(storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10,
      fileTypes: ["text"]
    })).resolves.toMatchObject([
      {
        chunkId: "doc_text_chunk_0"
      }
    ]);

    await expect(storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10,
      scoreThreshold: 0.99
    })).resolves.toMatchObject([
      {
        chunkId: "doc_near_chunk_0"
      },
      {
        chunkId: "doc_stale_chunk_0"
      }
    ]);

    storage.close();
  });

  it("cleans vector rows when document chunks are replaced", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await storage.upsertDocument(createDocument("doc_a"));

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(0)
    ], [
      createEmbedding("doc_a_chunk_0", 0)
    ]);
    await storage.replaceEmbeddingVectors([
      { embeddingId: "doc_a_chunk_0_embedding_0", vector: [1, 0, 0] }
    ]);
    expect(storage.countRows("vec_embeddings")).toBe(1);

    await storage.replaceDocumentChunks("doc_a", [
      createChunk(1)
    ], [
      createEmbedding("doc_a_chunk_1", 1)
    ]);
    expect(storage.countRows("vec_embeddings")).toBe(0);

    storage.close();
  });

  it("soft-deletes document chunks and excludes their vectors from search", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await storage.saveSources([createSource("source_a")]);
    await storage.upsertDocument(createDocument("doc_a"));
    const chunk = createChunk(0);
    const embedding = createEmbedding(chunk.chunkId, 0);
    await storage.replaceDocumentChunks("doc_a", [chunk], [embedding]);
    await storage.replaceEmbeddingVectors([
      { embeddingId: embedding.embeddingId, vector: [1, 0, 0] }
    ]);

    await storage.markDocumentDeleted("doc_a", 3000);

    await expect(storage.listActiveDocuments("source_a")).resolves.toEqual([]);
    await expect(storage.listDocumentChunks("doc_a")).resolves.toEqual([]);
    await expect(storage.searchVectors({
      vector: [1, 0, 0],
      limit: 10
    })).resolves.toEqual([]);
    expect(storage.countRows("chunks")).toBe(1);
    expect(storage.countRows("embeddings")).toBe(1);
    expect(storage.countRows("vec_embeddings")).toBe(1);

    storage.close();
  });

  it("preserves vector rows for unchanged replacement embeddings", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await storage.upsertDocument(createDocument("doc_a"));

    const unchangedChunk = createChunk(0);
    const changedChunk = createChunk(1);
    const preservedEmbedding = createEmbedding(unchangedChunk.chunkId, 0);
    const replacedEmbedding = createEmbedding(changedChunk.chunkId, 1);

    await storage.replaceDocumentChunks("doc_a", [
      unchangedChunk,
      changedChunk
    ], [
      preservedEmbedding,
      replacedEmbedding
    ]);
    await storage.replaceEmbeddingVectors([
      { embeddingId: preservedEmbedding.embeddingId, vector: [1, 0, 0] },
      { embeddingId: replacedEmbedding.embeddingId, vector: [0, 1, 0] }
    ]);

    const replacementChunk = createChunk(2);
    const newEmbedding = createEmbedding(replacementChunk.chunkId, 2);
    await storage.replaceDocumentChunks("doc_a", [
      unchangedChunk,
      replacementChunk
    ], [
      preservedEmbedding,
      newEmbedding
    ]);

    expect(storage.countRows("chunks")).toBe(2);
    expect(storage.countRows("embeddings")).toBe(2);
    expect(storage.countRows("vec_embeddings")).toBe(1);
    await expect(storage.listDocumentChunks("doc_a")).resolves.toMatchObject([
      {
        chunk: {
          chunkId: unchangedChunk.chunkId
        },
        embedding: {
          embeddingId: preservedEmbedding.embeddingId
        }
      },
      {
        chunk: {
          chunkId: replacementChunk.chunkId
        },
        embedding: {
          embeddingId: newEmbedding.embeddingId
        }
      }
    ]);

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
