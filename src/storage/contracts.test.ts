import { describe, expect, it } from "vitest";
import type {
  ChunkEmbeddingStore,
  DocumentRegistryStore,
  IndexConfigStore,
  SourceStatusStore,
  VectorSearchStore
} from "./contracts.js";

describe("storage capability contracts", () => {
  it("supports focused fake storage capabilities without SQLite details", async () => {
    const sources: SourceStatusStore = {
      saveSources: async () => undefined,
      listSources: async () => [
        {
          sourceId: "source-1",
          name: "Vault",
          type: "local-fs",
          rootUri: "file:///vault",
          status: "active"
        }
      ]
    };

    const documents: DocumentRegistryStore = {
      upsertDocument: async () => undefined,
      listActiveDocuments: async (sourceId) => [
        {
          documentId: "doc-1",
          sourceId,
          uri: "file:///vault/note.md",
          relativePath: "note.md",
          fileType: "text/markdown",
          status: "indexed",
          sourceUpdatedAt: 1_717_171_700_000
        }
      ],
      markDocumentDeleted: async () => undefined
    };

    const chunks: ChunkEmbeddingStore = {
      replaceDocumentChunks: async () => undefined,
      listDocumentChunks: async () => []
    };
    const vectors: VectorSearchStore = {
      searchVectors: async () => [{
        chunkId: "chunk-1",
        documentId: "doc-1",
        sourceId: "source-1",
        sourceName: "Vault",
        uri: "file:///vault/note.md",
        relativePath: "note.md",
        chunkIndex: 0,
        text: "Relevant chunk",
        distance: 0.1,
        score: 0.9,
        documentStatus: "indexed",
        sourceStatus: "active",
        sourceUpdatedAt: 1_717_171_700_000,
        indexedAt: 1_717_171_717_000
      }]
    };
    const indexConfig: IndexConfigStore = {
      readIndexConfig: async () => ({ model: "fake" }),
      writeIndexConfig: async () => undefined
    };

    await expect(sources.listSources()).resolves.toHaveLength(1);
    await expect(documents.listActiveDocuments("source-1")).resolves.toHaveLength(1);
    await expect(chunks.replaceDocumentChunks("doc-1", [], [])).resolves.toBeUndefined();
    await expect(chunks.listDocumentChunks("doc-1")).resolves.toEqual([]);
    await expect(vectors.searchVectors({ vector: [1, 0, 0], limit: 1 })).resolves.toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        sourceId: "source-1",
        sourceName: "Vault",
        uri: "file:///vault/note.md",
        relativePath: "note.md",
        chunkIndex: 0,
        text: "Relevant chunk",
        distance: 0.1,
        score: 0.9,
        documentStatus: "indexed",
        sourceStatus: "active",
        sourceUpdatedAt: 1_717_171_700_000,
        indexedAt: 1_717_171_717_000
      }
    ]);
    await expect(indexConfig.readIndexConfig()).resolves.toEqual({ model: "fake" });
  });
});
