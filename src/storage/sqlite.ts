import Database from "better-sqlite3";
import type { Database as DatabaseConnection } from "better-sqlite3";
import type { MetadataRecord } from "../shared/contracts.js";
import type {
  ChunkEmbeddingStore,
  DocumentRegistryStore,
  IndexConfigStore,
  SourceStatusStore,
  StoredChunk,
  StoredDocument,
  StoredEmbedding,
  StoredSource
} from "./contracts.js";
import { StorageError } from "./errors.js";

const schemaVersion = 1;

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

export class SQLiteStorage implements
  SourceStatusStore,
  DocumentRegistryStore,
  ChunkEmbeddingStore,
  IndexConfigStore {
  private readonly db: DatabaseConnection;

  constructor(private readonly databasePath: string) {
    try {
      this.db = new Database(databasePath);
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

  async markDocumentDeleted(
    documentId: string,
    deletedAt: number
  ): Promise<void> {
    this.db.prepare(`
      UPDATE documents
      SET status = 'deleted', deleted_at = ?
      WHERE document_id = ?
    `).run(deletedAt, documentId);
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: readonly StoredChunk[],
    embeddings: readonly StoredEmbedding[]
  ): Promise<void> {
    const replace = this.db.transaction(() => {
      this.db.prepare(`
        DELETE FROM embeddings
        WHERE chunk_id IN (
          SELECT chunk_id FROM chunks WHERE document_id = ?
        )
      `).run(documentId);
      this.db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);

      const insertChunk = this.db.prepare(`
        INSERT INTO chunks (
          chunk_id, document_id, source_id, chunk_index, text, content_hash, metadata_json
        ) VALUES (
          @chunkId, @documentId, @sourceId, @index, @text, @contentHash, @metadataJson
        )
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
  countRows(tableName: "chunks" | "embeddings"): number {
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

    this.db.prepare(`
      INSERT INTO meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO NOTHING
    `).run(String(schemaVersion));
  }
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

function stringifyMetadata(metadata: MetadataRecord | undefined): string | null {
  return metadata === undefined ? null : JSON.stringify(metadata);
}

function parseMetadata(value: string): MetadataRecord {
  return JSON.parse(value) as MetadataRecord;
}
