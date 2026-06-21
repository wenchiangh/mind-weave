import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  EmbeddingProvider,
  EmbeddingResult
} from "../embeddings/contracts.js";
import type {
  StoredChunk,
  StoredDocument,
  StoredEmbedding,
  StoredSource,
  VectorSearchInput,
  VectorSearchResult,
  VectorSearchStore
} from "../storage/contracts.js";
import { SQLiteStorage } from "../storage/sqlite.js";
import type { Vector } from "../shared/contracts.js";
import { CoreQueryService } from "./service.js";

class FixedEmbeddingProvider implements EmbeddingProvider {
  readonly queries: string[] = [];

  getConfig() {
    return {
      provider: "fake",
      model: "fake-query",
      dimensions: 3
    };
  }

  async embedDocuments(): Promise<readonly EmbeddingResult[]> {
    return [];
  }

  async embedQuery(text: string): Promise<Vector> {
    this.queries.push(text);
    return [1, 0, 0];
  }
}

class FailingEmbeddingProvider extends FixedEmbeddingProvider {
  override async embedQuery(_text: string): Promise<Vector> {
    throw new Error("embedding unavailable");
  }
}

class CapturingVectorSearchStore implements VectorSearchStore {
  inputs: VectorSearchInput[] = [];

  constructor(private readonly results: readonly VectorSearchResult[] = []) {}

  async searchVectors(input: VectorSearchInput): Promise<readonly VectorSearchResult[]> {
    this.inputs.push(input);
    return this.results;
  }
}

const storedResult: VectorSearchResult = {
  chunkId: "chunk-1",
  documentId: "doc-1",
  sourceId: "source-1",
  sourceName: "Vault",
  uri: "file:///vault/note.md",
  relativePath: "note.md",
  chunkIndex: 2,
  text: "Relevant chunk",
  distance: 0.1,
  score: 0.9,
  documentStatus: "indexed",
  sourceStatus: "active",
  sourceUpdatedAt: 1000,
  indexedAt: 2000,
  metadata: {
    section: "Intro"
  }
};

async function createDatabasePath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-query-"));
  return path.join(directory, "mind-weave.sqlite");
}

function createSource(
  sourceId: string,
  status: StoredSource["status"] = "active"
): StoredSource {
  return {
    sourceId,
    name: `Source ${sourceId}`,
    type: "local-fs",
    rootUri: `file:///tmp/${sourceId}`,
    status
  };
}

function createDocument(
  documentId: string,
  sourceId: string,
  status: StoredDocument["status"] = "indexed"
): StoredDocument {
  return {
    documentId,
    sourceId,
    uri: `file:///tmp/${sourceId}/${documentId}.md`,
    relativePath: `${documentId}.md`,
    fileType: "markdown",
    status,
    sourceUpdatedAt: 1000,
    indexedAt: 2000
  };
}

function createChunk(
  documentId: string,
  sourceId: string,
  text: string
): StoredChunk {
  return {
    chunkId: `${documentId}_chunk_0`,
    documentId,
    sourceId,
    index: 0,
    text,
    contentHash: `hash_${documentId}`
  };
}

function createEmbedding(chunk: StoredChunk): StoredEmbedding {
  return {
    embeddingId: `${chunk.chunkId}_embedding`,
    chunkId: chunk.chunkId,
    provider: "fake",
    model: "fake-query",
    dimensions: 3
  };
}

describe("CoreQueryService", () => {
  it("embeds trimmed query text and forwards SQL-filter options to storage", async () => {
    const embeddingProvider = new FixedEmbeddingProvider();
    const storage = new CapturingVectorSearchStore([storedResult]);
    const service = new CoreQueryService({
      embeddingProvider,
      storage
    });

    const results = await service.search({
      query: "  relevant topic  ",
      limit: 5,
      includeSourceIds: ["source-1"],
      excludeSourceIds: ["source-2"],
      fileTypes: ["markdown"],
      scoreThreshold: 0.75
    });

    expect(embeddingProvider.queries).toEqual(["relevant topic"]);
    expect(storage.inputs).toEqual([
      {
        vector: [1, 0, 0],
        limit: 5,
        includeSourceIds: ["source-1"],
        excludeSourceIds: ["source-2"],
        fileTypes: ["markdown"],
        scoreThreshold: 0.75
      }
    ]);
    expect(results).toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        sourceId: "source-1",
        sourceName: "Vault",
        uri: "file:///vault/note.md",
        relativePath: "note.md",
        chunkIndex: 2,
        text: "Relevant chunk",
        score: 0.9,
        documentStatus: "indexed",
        sourceStatus: "active",
        sourceUpdatedAt: 1000,
        indexedAt: 2000,
        metadata: {
          section: "Intro"
        }
      }
    ]);
  });

  it("uses the default limit when no limit is provided", async () => {
    const storage = new CapturingVectorSearchStore();
    const service = new CoreQueryService({
      embeddingProvider: new FixedEmbeddingProvider(),
      storage
    });

    await service.search({ query: "topic" });

    expect(storage.inputs[0]?.limit).toBe(8);
  });

  it("rejects blank queries and out-of-range limits before calling storage", async () => {
    const storage = new CapturingVectorSearchStore();
    const service = new CoreQueryService({
      embeddingProvider: new FixedEmbeddingProvider(),
      storage
    });

    await expect(service.search({ query: "   " })).rejects.toThrow("Query text is required.");
    await expect(service.search({ query: "topic", limit: 0 })).rejects.toThrow(
      "Query limit must be between 1 and 50."
    );
    await expect(service.search({ query: "topic", limit: 51 })).rejects.toThrow(
      "Query limit must be between 1 and 50."
    );
    expect(storage.inputs).toEqual([]);
  });

  it("propagates embedding provider errors", async () => {
    const service = new CoreQueryService({
      embeddingProvider: new FailingEmbeddingProvider(),
      storage: new CapturingVectorSearchStore()
    });

    await expect(service.search({ query: "topic" })).rejects.toThrow("embedding unavailable");
  });

  it("searches SQLite vector rows and returns full traceability metadata", async () => {
    const storage = new SQLiteStorage(await createDatabasePath(), {
      vectorDimensions: 3
    });
    await storage.saveSources([
      createSource("source_a"),
      createSource("source_disabled", "disabled")
    ]);

    const visibleDocument = createDocument("doc_visible", "source_a", "indexed");
    const staleDocument = createDocument("doc_stale", "source_a", "stale");
    const failedDocument = createDocument("doc_failed", "source_a", "failed");
    const disabledDocument = createDocument("doc_disabled", "source_disabled", "indexed");
    for (const document of [
      visibleDocument,
      staleDocument,
      failedDocument,
      disabledDocument
    ]) {
      await storage.upsertDocument(document);
      const chunk = createChunk(document.documentId, document.sourceId, document.documentId);
      const embedding = createEmbedding(chunk);
      await storage.replaceDocumentChunks(document.documentId, [chunk], [embedding]);
      await storage.replaceEmbeddingVectors([{
        embeddingId: embedding.embeddingId,
        vector: document.documentId === "doc_visible" ? [1, 0, 0] : [0.8, 0.2, 0]
      }]);
    }

    const service = new CoreQueryService({
      embeddingProvider: new FixedEmbeddingProvider(),
      storage
    });

    const results = await service.search({
      query: "visible",
      limit: 10,
      fileTypes: ["markdown"]
    });

    expect(results.map((result) => result.documentId)).toEqual([
      "doc_visible",
      "doc_stale"
    ]);
    expect(results[0]).toMatchObject({
      chunkId: "doc_visible_chunk_0",
      sourceId: "source_a",
      sourceName: "Source source_a",
      uri: "file:///tmp/source_a/doc_visible.md",
      relativePath: "doc_visible.md",
      chunkIndex: 0,
      text: "doc_visible",
      documentStatus: "indexed",
      sourceStatus: "active",
      sourceUpdatedAt: 1000,
      indexedAt: 2000
    });

    storage.close();
  });
});
