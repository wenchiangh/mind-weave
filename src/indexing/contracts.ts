import type {
  EntityId,
  FileType,
  UnixMilliseconds,
  UriString
} from "../shared/contracts.js";

export type IndexJobType = "upsert-document" | "delete-document";
export type IndexJobStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export type IndexDocumentTarget = {
  readonly documentId: EntityId;
  readonly sourceId: EntityId;
  readonly uri: UriString;
  readonly relativePath?: string;
  readonly fileType: FileType;
  readonly updatedAt: UnixMilliseconds;
  readonly size?: number;
};

export type IndexJob = {
  readonly jobId: EntityId;
  readonly type: IndexJobType;
  readonly target: IndexDocumentTarget;
  readonly status: IndexJobStatus;
  readonly attempts: number;
};

export interface IndexingService {
  enqueue(job: IndexJob): Promise<void>;
  drain(): Promise<void>;
}
