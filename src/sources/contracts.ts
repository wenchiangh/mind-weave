import type {
  EntityId,
  FileType,
  MetadataRecord,
  RelativePath,
  UnixMilliseconds,
  UriString
} from "../shared/contracts.js";

export type SourceId = EntityId;
export type SourceStatus = "active" | "disabled" | "error";
export type SourceType = "local-fs" | string;

export type SourceDefinition = {
  readonly id: SourceId;
  readonly type: SourceType;
  readonly name: string;
  readonly rootUri: UriString;
  readonly status: SourceStatus;
  readonly metadata?: MetadataRecord;
};

export type SourceCandidate = {
  readonly sourceId: SourceId;
  readonly uri: UriString;
  readonly relativePath?: RelativePath;
  readonly fileType: FileType;
  readonly updatedAt: UnixMilliseconds;
  readonly size: number;
  readonly metadata?: MetadataRecord;
};

export type SourceScanResult = {
  readonly sourceId: SourceId;
  readonly scannedAt: UnixMilliseconds;
  readonly candidates: readonly SourceCandidate[];
};

export interface SourceProvider {
  scan(source: SourceDefinition): Promise<SourceScanResult>;
}
