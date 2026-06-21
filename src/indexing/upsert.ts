import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type {
  EmbeddingConfigIdentity,
  EmbeddingProvider,
  EmbeddingResult
} from "../embeddings/contracts.js";
import type {
  DocumentProcessor,
  ProcessedChunk
} from "../processors/contracts.js";
import type { MetadataRecord, UnixMilliseconds } from "../shared/contracts.js";
import {
  createChunkContentHash,
  createChunkId,
  createDocumentFingerprint,
  createDocumentId,
  documentFingerprintsEqual
} from "../shared/identity.js";
import type { DocumentFingerprint } from "../shared/identity.js";
import type { SourceCandidate } from "../sources/contracts.js";
import type {
  ChunkEmbeddingStore,
  DocumentRegistryStore,
  EmbeddingVectorStore,
  StoredChunk,
  StoredDocument,
  StoredEmbedding,
  StoredEmbeddingVector
} from "../storage/contracts.js";

export type DocumentUpsertStorage =
  & DocumentRegistryStore
  & ChunkEmbeddingStore
  & EmbeddingVectorStore;

export type DocumentUpsertIndexerOptions = {
  readonly storage: DocumentUpsertStorage;
  readonly processors: readonly DocumentProcessor[];
  readonly embeddingProvider: EmbeddingProvider;
  readonly now?: (() => UnixMilliseconds) | undefined;
};

export type DocumentUpsertResult =
  | {
    readonly status: "indexed";
    readonly documentId: string;
    readonly chunkCount: number;
    readonly embeddedChunkCount: number;
    readonly preservedChunkCount: number;
  }
  | {
    readonly status: "skipped";
    readonly reason: "unchanged";
    readonly documentId: string;
  }
  | {
    readonly status: "stale" | "failed";
    readonly documentId: string;
    readonly error: string;
  };

type ExistingChunkByPreservationKey = Map<string, {
  readonly chunk: StoredChunk;
  readonly embedding: StoredEmbedding;
}>;

export class DocumentUpsertIndexer {
  private readonly storage: DocumentUpsertStorage;
  private readonly processors: readonly DocumentProcessor[];
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly now: () => UnixMilliseconds;

  constructor(options: DocumentUpsertIndexerOptions) {
    this.storage = options.storage;
    this.processors = options.processors;
    this.embeddingProvider = options.embeddingProvider;
    this.now = options.now ?? (() => Date.now());
  }

  async upsert(candidate: SourceCandidate): Promise<DocumentUpsertResult> {
    const documentId = createDocumentId(
      candidate.sourceId,
      candidate.relativePath ?? candidate.uri
    );
    const fingerprint = createDocumentFingerprint({
      mtimeMs: candidate.updatedAt,
      size: candidate.size
    });
    const existingDocument = await this.findExistingDocument(candidate.sourceId, documentId);

    if (isUnchanged(existingDocument, fingerprint)) {
      return {
        status: "skipped",
        reason: "unchanged",
        documentId
      };
    }

    try {
      const content = await readFile(fileURLToPath(candidate.uri), "utf8");
      const processor = this.selectProcessor(candidate.fileType);
      const processedChunks = await processor.process({
        documentId,
        sourceId: candidate.sourceId,
        uri: candidate.uri,
        fileType: candidate.fileType,
        content,
        sourceUpdatedAt: candidate.updatedAt,
        ...(candidate.metadata === undefined ? {} : { metadata: candidate.metadata })
      });
      const chunks = processedChunks.map((chunk) =>
        normalizeProcessedChunk(chunk, documentId, candidate.sourceId)
      );
      const embeddingConfig = this.embeddingProvider.getConfig();
      const existingChunks = await this.storage.listDocumentChunks(documentId);
      const reusableChunks = createReusableChunkMap(existingChunks, embeddingConfig);
      const preservedEmbeddings: StoredEmbedding[] = [];
      const chunksToEmbed: StoredChunk[] = [];

      for (const chunk of chunks) {
        const existing = reusableChunks.get(preservationKey(chunk));
        if (existing === undefined) {
          chunksToEmbed.push(chunk);
        } else {
          preservedEmbeddings.push(existing.embedding);
        }
      }

      const embeddingResults = chunksToEmbed.length === 0
        ? []
        : await this.embeddingProvider.embedDocuments(chunksToEmbed.map((chunk) => ({
          id: chunk.chunkId,
          text: chunk.text,
          ...(chunk.metadata === undefined ? {} : { metadata: chunk.metadata })
        })));
      const newEmbeddings = createStoredEmbeddings(chunksToEmbed, embeddingResults);
      const newVectors = createStoredVectors(newEmbeddings, embeddingResults);
      const indexedAt = this.now();

      await this.storage.upsertDocument({
        documentId,
        sourceId: candidate.sourceId,
        uri: candidate.uri,
        ...(candidate.relativePath === undefined ? {} : { relativePath: candidate.relativePath }),
        fileType: candidate.fileType,
        status: "indexed",
        sourceUpdatedAt: candidate.updatedAt,
        indexedAt,
        metadata: createDocumentMetadata(fingerprint)
      });
      await this.storage.replaceDocumentChunks(documentId, chunks, [
        ...preservedEmbeddings,
        ...newEmbeddings
      ]);
      await this.storage.replaceEmbeddingVectors(newVectors);

      return {
        status: "indexed",
        documentId,
        chunkCount: chunks.length,
        embeddedChunkCount: newEmbeddings.length,
        preservedChunkCount: preservedEmbeddings.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = existingDocument?.status === "indexed" || existingDocument?.status === "stale"
        ? "stale"
        : "failed";

      await this.storage.upsertDocument({
        documentId,
        sourceId: candidate.sourceId,
        uri: candidate.uri,
        ...(candidate.relativePath === undefined ? {} : { relativePath: candidate.relativePath }),
        fileType: candidate.fileType,
        status,
        sourceUpdatedAt: candidate.updatedAt,
        ...(existingDocument?.indexedAt === undefined ? {} : {
          indexedAt: existingDocument.indexedAt
        }),
        lastError: message,
        metadata: createDocumentMetadata(fingerprint)
      });

      return {
        status,
        documentId,
        error: message
      };
    }
  }

  private async findExistingDocument(
    sourceId: string,
    documentId: string
  ): Promise<StoredDocument | undefined> {
    const documents = await this.storage.listActiveDocuments(sourceId);
    return documents.find((document) => document.documentId === documentId);
  }

  private selectProcessor(fileType: string): DocumentProcessor {
    const processor = this.processors.find((candidate) => candidate.supports(fileType));
    if (processor === undefined) {
      throw new Error(`No document processor supports file type: ${fileType}`);
    }
    return processor;
  }
}

function normalizeProcessedChunk(
  chunk: ProcessedChunk,
  documentId: string,
  sourceId: string
): StoredChunk {
  const contentHash = chunk.contentHash ?? createChunkContentHash(chunk.text);
  const chunkId = chunk.chunkId ?? createChunkId({
    documentId,
    chunkIndex: chunk.index,
    chunkContentHash: contentHash
  });

  return {
    chunkId,
    documentId,
    sourceId,
    index: chunk.index,
    text: chunk.text,
    contentHash,
    ...(chunk.metadata === undefined ? {} : { metadata: chunk.metadata })
  };
}

function createReusableChunkMap(
  existingChunks: Awaited<ReturnType<ChunkEmbeddingStore["listDocumentChunks"]>>,
  embeddingConfig: EmbeddingConfigIdentity
): ExistingChunkByPreservationKey {
  const result: ExistingChunkByPreservationKey = new Map();

  for (const item of existingChunks) {
    if (item.embedding === undefined) {
      continue;
    }

    if (!embeddingConfigMatches(item.embedding, embeddingConfig)) {
      continue;
    }

    result.set(preservationKey(item.chunk), {
      chunk: item.chunk,
      embedding: item.embedding
    });
  }

  return result;
}

function preservationKey(chunk: StoredChunk): string {
  return [
    chunk.documentId,
    chunk.index,
    chunk.contentHash
  ].join("\0");
}

function embeddingConfigMatches(
  embedding: StoredEmbedding,
  config: EmbeddingConfigIdentity
): boolean {
  return embedding.provider === config.provider
    && embedding.model === config.model
    && embedding.dimensions === config.dimensions;
}

function createStoredEmbeddings(
  chunks: readonly StoredChunk[],
  results: readonly EmbeddingResult[]
): readonly StoredEmbedding[] {
  const resultByInputId = new Map(results.map((result) => [result.inputId, result]));

  return chunks.map((chunk) => {
    const result = resultByInputId.get(chunk.chunkId);
    if (result === undefined) {
      throw new Error(`Embedding provider did not return result for chunk: ${chunk.chunkId}`);
    }

    return {
      embeddingId: createEmbeddingId(chunk.chunkId, result.config),
      chunkId: chunk.chunkId,
      provider: result.config.provider,
      model: result.config.model,
      ...(result.config.dimensions === undefined ? {} : { dimensions: result.config.dimensions })
    };
  });
}

function createStoredVectors(
  embeddings: readonly StoredEmbedding[],
  results: readonly EmbeddingResult[]
): readonly StoredEmbeddingVector[] {
  const embeddingIdByChunkId = new Map(
    embeddings.map((embedding) => [embedding.chunkId, embedding.embeddingId])
  );

  return results.map((result) => {
    const embeddingId = embeddingIdByChunkId.get(result.inputId);
    if (embeddingId === undefined) {
      throw new Error(`Cannot map embedding vector to chunk: ${result.inputId}`);
    }

    return {
      embeddingId,
      vector: result.vector
    };
  });
}

function createEmbeddingId(
  chunkId: string,
  config: EmbeddingConfigIdentity
): string {
  const hash = crypto.createHash("sha256")
    .update(chunkId)
    .update("\0")
    .update(config.provider)
    .update("\0")
    .update(config.model)
    .update("\0")
    .update(String(config.dimensions ?? ""))
    .digest("hex");

  return `embedding_${hash.slice(0, 16)}`;
}

function isUnchanged(
  document: StoredDocument | undefined,
  fingerprint: DocumentFingerprint
): boolean {
  if (document === undefined || document.status === "failed") {
    return false;
  }

  const existing = readStoredFingerprint(document.metadata);
  return existing === undefined ? false : documentFingerprintsEqual(existing, fingerprint);
}

function readStoredFingerprint(
  metadata: MetadataRecord | undefined
): DocumentFingerprint | undefined {
  const value = metadata?.fingerprint;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as { readonly [key: string]: unknown };
  const mtimeMs = record.mtimeMs;
  const size = record.size;
  if (typeof mtimeMs !== "number" || typeof size !== "number") {
    return undefined;
  }

  return {
    mtimeMs,
    size
  };
}

function createDocumentMetadata(
  fingerprint: DocumentFingerprint
): MetadataRecord {
  return {
    fingerprint
  };
}
