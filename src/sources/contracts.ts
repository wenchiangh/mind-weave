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

export type SourceInspectionSkippedCounts = {
  readonly excluded: number;
  readonly ignored: number;
  readonly unsupported: number;
  readonly symlink: number;
};

export type SourceInspectionResult = {
  readonly sourceId: SourceId;
  readonly inspectedAt: UnixMilliseconds;
  readonly rootUri: UriString;
  readonly includedCandidates: readonly SourceCandidate[];
  readonly skipped: SourceInspectionSkippedCounts;
  readonly topLevelPathCounts: Record<string, number>;
  readonly sampleIncludedPaths: readonly RelativePath[];
  readonly sampleExcludedPaths: readonly RelativePath[];
};

export type SourceDeleteTarget = {
  readonly sourceId: SourceId;
  readonly uri: UriString;
  readonly relativePath?: RelativePath;
  readonly fileType: FileType;
};

export type SourceFileEvent =
  | {
    readonly type: "upsert";
    readonly candidate: SourceCandidate;
  }
  | {
    readonly type: "delete";
    readonly target: SourceDeleteTarget;
  };

export type SourceWatchEventInput = {
  readonly kind: "create" | "change" | "delete";
  readonly absolutePath: string;
};

export interface SourceWatcher {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface SourceProvider {
  scan(source: SourceDefinition): Promise<SourceScanResult>;
}

export interface SourceInspector {
  inspect(source: SourceDefinition): Promise<SourceInspectionResult>;
}
