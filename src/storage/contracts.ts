import type {
  EntityId,
  FileType,
  MetadataRecord,
  UnixMilliseconds,
  UriString,
  Vector
} from "../shared/contracts.js";

export type StoredSource = {
  readonly sourceId: EntityId;
  readonly name: string;
  readonly type: string;
  readonly rootUri: UriString;
  readonly status: "active" | "disabled" | "error";
  readonly lastScannedAt?: UnixMilliseconds;
  readonly lastError?: string;
};

export type StoredDocument = {
  readonly documentId: EntityId;
  readonly sourceId: EntityId;
  readonly uri: UriString;
  readonly relativePath?: string;
  readonly fileType: FileType;
  readonly status: "indexed" | "stale" | "failed" | "deleted";
  readonly sourceUpdatedAt: UnixMilliseconds;
  readonly indexedAt?: UnixMilliseconds;
  readonly deletedAt?: UnixMilliseconds;
  readonly lastError?: string;
  readonly metadata?: MetadataRecord;
};

export type StoredChunk = {
  readonly chunkId: EntityId;
  readonly documentId: EntityId;
  readonly sourceId: EntityId;
  readonly index: number;
  readonly text: string;
  readonly contentHash: string;
  readonly metadata?: MetadataRecord;
};

export type StoredEmbedding = {
  readonly embeddingId: EntityId;
  readonly chunkId: EntityId;
  readonly provider: string;
  readonly model: string;
  readonly dimensions?: number;
};

export type StoredEmbeddingVector = {
  readonly embeddingId: EntityId;
  readonly vector: Vector;
};

export type StoredChunkWithEmbedding = {
  readonly chunk: StoredChunk;
  readonly embedding?: StoredEmbedding | undefined;
};

export type VectorSearchInput = {
  readonly vector: Vector;
  readonly limit: number;
  readonly includeSourceIds?: readonly EntityId[];
  readonly excludeSourceIds?: readonly EntityId[];
  readonly fileTypes?: readonly FileType[];
  readonly scoreThreshold?: number;
};

export type VectorSearchResult = {
  readonly chunkId: EntityId;
  readonly distance: number;
  readonly score: number;
};

export interface SourceStatusStore {
  saveSources(sources: readonly StoredSource[]): Promise<void>;
  listSources(): Promise<readonly StoredSource[]>;
}

export interface DocumentRegistryStore {
  upsertDocument(document: StoredDocument): Promise<void>;
  listActiveDocuments(sourceId: EntityId): Promise<readonly StoredDocument[]>;
  markDocumentDeleted(documentId: EntityId, deletedAt: UnixMilliseconds): Promise<void>;
}

export interface ChunkEmbeddingStore {
  replaceDocumentChunks(
    documentId: EntityId,
    chunks: readonly StoredChunk[],
    embeddings: readonly StoredEmbedding[]
  ): Promise<void>;
  listDocumentChunks(documentId: EntityId): Promise<readonly StoredChunkWithEmbedding[]>;
}

export interface EmbeddingVectorStore {
  replaceEmbeddingVectors(vectors: readonly StoredEmbeddingVector[]): Promise<void>;
}

export interface VectorSearchStore {
  searchVectors(input: VectorSearchInput): Promise<readonly VectorSearchResult[]>;
}

export interface IndexConfigStore {
  readIndexConfig(): Promise<MetadataRecord | null>;
  writeIndexConfig(config: MetadataRecord): Promise<void>;
}
