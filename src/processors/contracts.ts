import type {
  EntityId,
  FileType,
  MetadataRecord,
  UnixMilliseconds,
  UriString
} from "../shared/contracts.js";

export type DocumentId = EntityId;
export type ChunkId = EntityId;

export type ProcessableDocument = {
  readonly documentId: DocumentId;
  readonly sourceId: EntityId;
  readonly uri: UriString;
  readonly fileType: FileType;
  readonly content: string;
  readonly sourceUpdatedAt: UnixMilliseconds;
  readonly metadata?: MetadataRecord;
};

export type ProcessedChunk = {
  readonly chunkId?: ChunkId;
  readonly documentId: DocumentId;
  readonly sourceId: EntityId;
  readonly index: number;
  readonly text: string;
  readonly contentHash?: string;
  readonly metadata?: MetadataRecord;
};

export interface DocumentProcessor {
  supports(fileType: FileType): boolean;
  process(document: ProcessableDocument): Promise<readonly ProcessedChunk[]>;
}
