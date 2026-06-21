import type {
  EntityId,
  FileType,
  MetadataRecord,
  UnixMilliseconds,
  UriString
} from "../shared/contracts.js";

export type QueryInput = {
  readonly query: string;
  readonly limit?: number;
  readonly includeSourceIds?: readonly EntityId[];
  readonly excludeSourceIds?: readonly EntityId[];
  readonly fileTypes?: readonly FileType[];
  readonly scoreThreshold?: number;
};

export type QueryResult = {
  readonly chunkId: EntityId;
  readonly documentId: EntityId;
  readonly sourceId: EntityId;
  readonly sourceName: string;
  readonly uri: UriString;
  readonly relativePath?: string;
  readonly chunkIndex: number;
  readonly text: string;
  readonly score: number;
  readonly documentStatus: string;
  readonly sourceStatus: string;
  readonly sourceUpdatedAt: UnixMilliseconds;
  readonly indexedAt: UnixMilliseconds;
  readonly metadata?: MetadataRecord;
};

export interface QueryService {
  search(input: QueryInput): Promise<readonly QueryResult[]>;
}
