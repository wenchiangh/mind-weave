import Database from "better-sqlite3";
import type { Database as DatabaseConnection } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { MetadataRecord } from "../shared/contracts.js";
import type {
  ChunkEmbeddingStore,
  DocumentStatusCounts,
  DocumentStatusStore,
  DocumentRegistryStore,
  EmbeddingVectorStore,
  IndexStats,
  IndexStatsStore,
  IndexConfigStore,
  SourceStatusStore,
  StoredChunk,
  StoredChunkWithEmbedding,
  StoredDocument,
  StoredEmbedding,
  StoredEmbeddingVector,
  StoredSource,
  VectorSearchInput,
  VectorSearchResult,
  VectorSearchStore
} from "./contracts.js";
import { StorageError } from "./errors.js";

const schemaVersion = 3;
const defaultVectorDimensions = 1536;

export type SQLiteStorageOptions = {
  readonly vectorDimensions?: number | undefined;
  readonly vectorSearchOverfetchFactor?: number | undefined;
};

type JsonRow = {
  readonly value: string;
};

type SourceRow = {
  readonly source_id: string;
  readonly name: string;
  readonly type: string;
  readonly root_uri: string;
  readonly status: StoredSource["status"];
  readonly last_scanned_at: number | null;
  readonly last_error: string | null;
};

type DocumentRow = {
  readonly document_id: string;
  readonly source_id: string;
  readonly uri: string;
  readonly relative_path: string | null;
  readonly file_type: string;
  readonly status: StoredDocument["status"];
  readonly source_updated_at: number;
  readonly indexed_at: number | null;
  readonly deleted_at: number | null;
  readonly last_error: string | null;
  readonly metadata_json: string | null;
};

type ChunkEmbeddingRow = {
  readonly chunk_id: string;
  readonly document_id: string;
  readonly source_id: string;
  readonly chunk_index: number;
  readonly text: string;
  readonly content_hash: string;
  readonly chunk_metadata_json: string | null;
  readonly embedding_id: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly dimensions: number | null;
};

export class SQLiteStorage implements
  SourceStatusStore,
  DocumentRegistryStore,
  DocumentStatusStore,
  IndexStatsStore,
  ChunkEmbeddingStore,
  EmbeddingVectorStore,
  VectorSearchStore,
  IndexConfigStore {
  private readonly db: DatabaseConnection;
  private readonly vectorDimensions: number;
  private readonly vectorSearchOverfetchFactor: number;

  constructor(
    private readonly databasePath: string,
    options: SQLiteStorageOptions = {}
  ) {
    this.vectorDimensions = options.vectorDimensions ?? defaultVectorDimensions;
    this.vectorSearchOverfetchFactor = options.vectorSearchOverfetchFactor ?? 10;

    try {
      this.db = new Database(databasePath);
      sqliteVec.load(this.db);
      this.db.pragma("foreign_keys = ON");
      this.initializeSchema();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError({
        code: "STORAGE_OPEN_FAILED",
        databasePath,
        message: `Unable to open SQLite database: ${databasePath}`,
        cause: error
      });
    }
  }

  close(): void {
    this.db.close();
  }

  async saveSources(sources: readonly StoredSource[]): Promise<void> {
    const save = this.db.transaction((items: readonly StoredSource[]) => {
      this.db.prepare("DELETE FROM sources").run();
      const insert = this.db.prepare(`
        INSERT INTO sources (
          source_id, name, type, root_uri, status, last_scanned_at, last_error
        ) VALUES (
          @sourceId, @name, @type, @rootUri, @status, @lastScannedAt, @lastError
        )
      `);

      for (const source of items) {
        insert.run({
          sourceId: source.sourceId,
          name: source.name,
          type: source.type,
          rootUri: source.rootUri,
          status: source.status,
          lastScannedAt: source.lastScannedAt ?? null,
          lastError: source.lastError ?? null
        });
      }
    });

    save(sources);
  }

  async listSources(): Promise<readonly StoredSource[]> {
    return this.db.prepare("SELECT * FROM sources ORDER BY source_id")
      .all()
      .map((row) => mapSourceRow(row as SourceRow));
  }

  async upsertDocument(document: StoredDocument): Promise<void> {
    this.db.prepare(`
      INSERT INTO documents (
        document_id,
        source_id,
        uri,
        relative_path,
        file_type,
        status,
        source_updated_at,
        indexed_at,
        deleted_at,
        last_error,
        metadata_json
      ) VALUES (
        @documentId,
        @sourceId,
        @uri,
        @relativePath,
        @fileType,
        @status,
        @sourceUpdatedAt,
        @indexedAt,
        @deletedAt,
        @lastError,
        @metadataJson
      )
      ON CONFLICT(document_id) DO UPDATE SET
        source_id = excluded.source_id,
        uri = excluded.uri,
        relative_path = excluded.relative_path,
        file_type = excluded.file_type,
        status = excluded.status,
        source_updated_at = excluded.source_updated_at,
        indexed_at = excluded.indexed_at,
        deleted_at = excluded.deleted_at,
        last_error = excluded.last_error,
        metadata_json = excluded.metadata_json
    `).run({
      documentId: document.documentId,
      sourceId: document.sourceId,
      uri: document.uri,
      relativePath: document.relativePath ?? null,
      fileType: document.fileType,
      status: document.status,
      sourceUpdatedAt: document.sourceUpdatedAt,
      indexedAt: document.indexedAt ?? null,
      deletedAt: document.deletedAt ?? null,
      lastError: document.lastError ?? null,
      metadataJson: stringifyMetadata(document.metadata)
    });
  }

  async listActiveDocuments(sourceId: string): Promise<readonly StoredDocument[]> {
    return this.db.prepare(`
      SELECT * FROM documents
      WHERE source_id = ? AND status != 'deleted'
      ORDER BY relative_path, document_id
    `)
      .all(sourceId)
      .map((row) => mapDocumentRow(row as DocumentRow));
  }

  async countDocumentsByStatus(): Promise<DocumentStatusCounts> {
    const counts = createEmptyDocumentStatusCounts();
    const rows = this.db.prepare(`
      SELECT status AS value, COUNT(*) AS count
      FROM documents
      GROUP BY status
    `).all() as Array<{
      readonly value: StoredDocument["status"];
      readonly count: number;
    }>;

    for (const row of rows) {
      counts[row.value] = row.count;
    }

    return counts;
  }

  async readIndexStats(): Promise<IndexStats> {
    const sourceRows = this.db.prepare(`
      SELECT
        sources.source_id AS sourceId,
        documents.status AS status,
        COUNT(documents.document_id) AS count
      FROM sources
      LEFT JOIN documents ON documents.source_id = sources.source_id
      GROUP BY sources.source_id, documents.status
      ORDER BY sources.source_id
    `).all() as Array<{
      readonly sourceId: string;
      readonly status: StoredDocument["status"] | null;
      readonly count: number;
    }>;
    const bySource = new Map<string, DocumentStatusCounts>();

    for (const row of sourceRows) {
      const counts = bySource.get(row.sourceId) ?? createEmptyDocumentStatusCounts();
      if (row.status !== null) {
        counts[row.status] = row.count;
      }
      bySource.set(row.sourceId, counts);
    }

    return {
      chunks: this.countRows("chunks"),
      embeddings: this.countRows("embeddings"),
      sources: [...bySource.entries()].map(([sourceId, documents]) => ({
        sourceId,
        documents
      }))
    };
  }

  async markDocumentDeleted(
    documentId: string,
    deletedAt: number
  ): Promise<void> {
    const markDeleted = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE documents
        SET status = 'deleted', deleted_at = ?
        WHERE document_id = ?
      `).run(deletedAt, documentId);
      this.db.prepare(`
        UPDATE chunks
        SET deleted_at = ?
        WHERE document_id = ?
      `).run(deletedAt, documentId);
    });

    markDeleted();
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: readonly StoredChunk[],
    embeddings: readonly StoredEmbedding[]
  ): Promise<void> {
    const replace = this.db.transaction(() => {
      const newEmbeddingIds = new Set(embeddings.map((embedding) => embedding.embeddingId));
      const oldEmbeddingRows = this.db.prepare(`
        SELECT embedding_id AS value
        FROM embeddings
        WHERE chunk_id IN (
          SELECT chunk_id FROM chunks WHERE document_id = ?
        )
      `).all(documentId) as JsonRow[];
      const removedEmbeddingIds = oldEmbeddingRows
        .map((row) => row.value)
        .filter((embeddingId) => !newEmbeddingIds.has(embeddingId));

      const deleteVector = this.db.prepare(`
        DELETE FROM vec_embeddings WHERE embedding_id = ?
      `);
      for (const embeddingId of removedEmbeddingIds) {
        deleteVector.run(embeddingId);
      }

      if (removedEmbeddingIds.length > 0) {
        this.db.prepare(`
          DELETE FROM embeddings
          WHERE embedding_id IN (${removedEmbeddingIds.map(() => "?").join(", ")})
        `).run(...removedEmbeddingIds);
      }

      if (chunks.length === 0) {
        this.db.prepare(`
          DELETE FROM chunks
          WHERE document_id = ?
        `).run(documentId);
      } else {
        this.db.prepare(`
          DELETE FROM chunks
          WHERE document_id = ?
            AND chunk_id NOT IN (${chunks.map(() => "?").join(", ")})
        `).run(documentId, ...chunks.map((chunk) => chunk.chunkId));
      }

      const insertChunk = this.db.prepare(`
        INSERT INTO chunks (
          chunk_id,
          document_id,
          source_id,
          chunk_index,
          text,
          content_hash,
          metadata_json,
          deleted_at
        ) VALUES (
          @chunkId,
          @documentId,
          @sourceId,
          @index,
          @text,
          @contentHash,
          @metadataJson,
          NULL
        )
        ON CONFLICT(chunk_id) DO UPDATE SET
          document_id = excluded.document_id,
          source_id = excluded.source_id,
          chunk_index = excluded.chunk_index,
          text = excluded.text,
          content_hash = excluded.content_hash,
          metadata_json = excluded.metadata_json,
          deleted_at = NULL
      `);
      for (const chunk of chunks) {
        insertChunk.run({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          sourceId: chunk.sourceId,
          index: chunk.index,
          text: chunk.text,
          contentHash: chunk.contentHash,
          metadataJson: stringifyMetadata(chunk.metadata)
        });
      }

      const insertEmbedding = this.db.prepare(`
        INSERT INTO embeddings (
          embedding_id, chunk_id, provider, model, dimensions
        ) VALUES (
          @embeddingId, @chunkId, @provider, @model, @dimensions
        )
        ON CONFLICT(embedding_id) DO UPDATE SET
          chunk_id = excluded.chunk_id,
          provider = excluded.provider,
          model = excluded.model,
          dimensions = excluded.dimensions
      `);
      for (const embedding of embeddings) {
        insertEmbedding.run({
          embeddingId: embedding.embeddingId,
          chunkId: embedding.chunkId,
          provider: embedding.provider,
          model: embedding.model,
          dimensions: embedding.dimensions ?? null
        });
      }
    });

    replace();
  }

  async listDocumentChunks(
    documentId: string
  ): Promise<readonly StoredChunkWithEmbedding[]> {
    const rows = this.db.prepare(`
      SELECT
        chunks.chunk_id,
        chunks.document_id,
        chunks.source_id,
        chunks.chunk_index,
        chunks.text,
        chunks.content_hash,
        chunks.metadata_json AS chunk_metadata_json,
        embeddings.embedding_id,
        embeddings.provider,
        embeddings.model,
        embeddings.dimensions
      FROM chunks
      LEFT JOIN embeddings ON embeddings.chunk_id = chunks.chunk_id
      WHERE chunks.document_id = ?
        AND chunks.deleted_at IS NULL
      ORDER BY chunks.chunk_index
    `).all(documentId) as ChunkEmbeddingRow[];

    return rows.map(mapChunkEmbeddingRow);
  }

  async replaceEmbeddingVectors(
    vectors: readonly StoredEmbeddingVector[]
  ): Promise<void> {
    const replace = this.db.transaction((items: readonly StoredEmbeddingVector[]) => {
      const parentExists = this.db.prepare(`
        SELECT 1 FROM embeddings WHERE embedding_id = ?
      `);
      const deleteVector = this.db.prepare(`
        DELETE FROM vec_embeddings WHERE embedding_id = ?
      `);
      const insertVector = this.db.prepare(`
        INSERT INTO vec_embeddings (embedding, embedding_id)
        VALUES (vec_f32(?), ?)
      `);

      for (const item of items) {
        if (parentExists.get(item.embeddingId) === undefined) {
          throw new StorageError({
            code: "STORAGE_OPERATION_FAILED",
            databasePath: this.databasePath,
            message: `Cannot write vector without embedding metadata parent: ${item.embeddingId}`
          });
        }

        deleteVector.run(item.embeddingId);
        insertVector.run(JSON.stringify(item.vector), item.embeddingId);
      }
    });

    replace(vectors);
  }

  async searchVectors(input: VectorSearchInput): Promise<readonly VectorSearchResult[]> {
    const limit = Math.max(1, input.limit);
    const candidateLimit = Math.max(
      limit,
      limit * this.vectorSearchOverfetchFactor
    );
    const parameters: Record<string, unknown> = {
      queryVector: JSON.stringify(input.vector),
      candidateLimit,
      limit,
      scoreThreshold: input.scoreThreshold ?? null
    };
    const conditions = [
      "documents.status IN ('indexed', 'stale')",
      "chunks.deleted_at IS NULL",
      "sources.status != 'disabled'"
    ];

    if (input.includeSourceIds !== undefined && input.includeSourceIds.length > 0) {
      conditions.push(`documents.source_id IN (${bindList(
        "includeSourceId",
        input.includeSourceIds,
        parameters
      )})`);
    }

    if (input.excludeSourceIds !== undefined && input.excludeSourceIds.length > 0) {
      conditions.push(`documents.source_id NOT IN (${bindList(
        "excludeSourceId",
        input.excludeSourceIds,
        parameters
      )})`);
    }

    if (input.fileTypes !== undefined && input.fileTypes.length > 0) {
      conditions.push(`documents.file_type IN (${bindList(
        "fileType",
        input.fileTypes,
        parameters
      )})`);
    }

    if (input.scoreThreshold !== undefined) {
      conditions.push("(1.0 / (1.0 + knn.distance)) >= @scoreThreshold");
    }

    const rows = this.db.prepare(`
      WITH knn AS (
        SELECT embedding_id, distance
        FROM vec_embeddings
        WHERE embedding MATCH vec_f32(@queryVector)
          AND k = @candidateLimit
      )
      SELECT
        chunks.chunk_id AS chunkId,
        chunks.document_id AS documentId,
        chunks.source_id AS sourceId,
        sources.name AS sourceName,
        documents.uri AS uri,
        chunks.text AS text,
        knn.distance AS distance,
        1.0 / (1.0 + knn.distance) AS score,
        documents.status AS documentStatus,
        sources.status AS sourceStatus,
        documents.source_updated_at AS sourceUpdatedAt,
        COALESCE(documents.indexed_at, documents.source_updated_at) AS indexedAt,
        chunks.metadata_json AS metadataJson
      FROM knn
      JOIN embeddings ON embeddings.embedding_id = knn.embedding_id
      JOIN chunks ON chunks.chunk_id = embeddings.chunk_id
      JOIN documents ON documents.document_id = chunks.document_id
      JOIN sources ON sources.source_id = documents.source_id
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY knn.distance ASC
      LIMIT @limit
    `).all(parameters) as Array<{
      readonly chunkId: string;
      readonly documentId: string;
      readonly sourceId: string;
      readonly sourceName: string;
      readonly uri: string;
      readonly text: string;
      readonly distance: number;
      readonly score: number;
      readonly documentStatus: StoredDocument["status"];
      readonly sourceStatus: StoredSource["status"];
      readonly sourceUpdatedAt: number;
      readonly indexedAt: number;
      readonly metadataJson: string | null;
    }>;

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      uri: row.uri,
      text: row.text,
      distance: row.distance,
      score: row.score,
      documentStatus: row.documentStatus,
      sourceStatus: row.sourceStatus,
      sourceUpdatedAt: row.sourceUpdatedAt,
      indexedAt: row.indexedAt,
      ...(row.metadataJson === null ? {} : { metadata: parseMetadata(row.metadataJson) })
    }));
  }

  async readIndexConfig(): Promise<MetadataRecord | null> {
    const row = this.db.prepare(`
      SELECT config_json AS value FROM index_config WHERE id = 'active'
    `).get() as JsonRow | undefined;

    return row === undefined ? null : parseMetadata(row.value);
  }

  async writeIndexConfig(config: MetadataRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO index_config (id, config_json)
      VALUES ('active', ?)
      ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json
    `).run(JSON.stringify(config));
  }

  // Test and maintenance visibility. Runtime/query code should use domain methods.
  countRows(tableName: "chunks" | "embeddings" | "vec_embeddings"): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS value FROM ${tableName}`).get() as {
      readonly value: number;
    };
    return row.value;
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const existing = this.db.prepare(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    ).get() as JsonRow | undefined;

    if (existing !== undefined && Number(existing.value) !== schemaVersion) {
      throw new StorageError({
        code: "STORAGE_SCHEMA_INCOMPATIBLE",
        databasePath: this.databasePath,
        message: `SQLite schema version ${existing.value} is incompatible with expected version ${schemaVersion}.`
      });
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        source_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        root_uri TEXT NOT NULL,
        status TEXT NOT NULL,
        last_scanned_at INTEGER,
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS documents (
        document_id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        uri TEXT NOT NULL,
        relative_path TEXT,
        file_type TEXT NOT NULL,
        status TEXT NOT NULL,
        source_updated_at REAL NOT NULL,
        indexed_at REAL,
        deleted_at REAL,
        last_error TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_documents_source_status
        ON documents(source_id, status);

      CREATE TABLE IF NOT EXISTS chunks (
        chunk_id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        metadata_json TEXT,
        deleted_at REAL,
        UNIQUE(document_id, chunk_index)
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_document
        ON chunks(document_id);

      CREATE TABLE IF NOT EXISTS embeddings (
        embedding_id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER,
        UNIQUE(chunk_id),
        FOREIGN KEY(chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS index_config (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings
      USING vec0(
        embedding float[${this.vectorDimensions}] distance_metric=cosine,
        embedding_id text
      );
    `);

    this.db.prepare(`
      INSERT INTO meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO NOTHING
    `).run(String(schemaVersion));
  }
}

function bindList(
  prefix: string,
  values: readonly string[],
  parameters: Record<string, unknown>
): string {
  return values.map((value, index) => {
    const key = `${prefix}${index}`;
    parameters[key] = value;
    return `@${key}`;
  }).join(", ");
}

function mapSourceRow(row: SourceRow): StoredSource {
  return {
    sourceId: row.source_id,
    name: row.name,
    type: row.type,
    rootUri: row.root_uri,
    status: row.status,
    ...(row.last_scanned_at === null ? {} : { lastScannedAt: row.last_scanned_at }),
    ...(row.last_error === null ? {} : { lastError: row.last_error })
  };
}

function createEmptyDocumentStatusCounts(): DocumentStatusCounts {
  return {
    indexed: 0,
    stale: 0,
    failed: 0,
    deleted: 0
  };
}

function mapDocumentRow(row: DocumentRow): StoredDocument {
  const document: StoredDocument = {
    documentId: row.document_id,
    sourceId: row.source_id,
    uri: row.uri,
    fileType: row.file_type,
    status: row.status,
    sourceUpdatedAt: row.source_updated_at
  };

  return {
    ...document,
    ...(row.relative_path === null ? {} : { relativePath: row.relative_path }),
    ...(row.indexed_at === null ? {} : { indexedAt: row.indexed_at }),
    ...(row.deleted_at === null ? {} : { deletedAt: row.deleted_at }),
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    ...(row.metadata_json === null ? {} : { metadata: parseMetadata(row.metadata_json) })
  };
}

function mapChunkEmbeddingRow(row: ChunkEmbeddingRow): StoredChunkWithEmbedding {
  return {
    chunk: {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      sourceId: row.source_id,
      index: row.chunk_index,
      text: row.text,
      contentHash: row.content_hash,
      ...(row.chunk_metadata_json === null ? {} : {
        metadata: parseMetadata(row.chunk_metadata_json)
      })
    },
    ...(row.embedding_id === null
      || row.provider === null
      || row.model === null
      ? {}
      : {
        embedding: {
          embeddingId: row.embedding_id,
          chunkId: row.chunk_id,
          provider: row.provider,
          model: row.model,
          ...(row.dimensions === null ? {} : { dimensions: row.dimensions })
        }
      })
  };
}

function stringifyMetadata(metadata: MetadataRecord | undefined): string | null {
  return metadata === undefined ? null : JSON.stringify(metadata);
}

function parseMetadata(value: string): MetadataRecord {
  return JSON.parse(value) as MetadataRecord;
}
