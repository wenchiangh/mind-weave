import type { SourceDefinition } from "../sources/contracts.js";
import type { QueryResult } from "../query/contracts.js";
import type { McpToolHandlers } from "../interfaces/mcp/index.js";
import type {
  DocumentStatusCounts,
  SourceDocumentStatusCounts
} from "../storage/contracts.js";

export type RuntimeHealth = {
  readonly name: "mind-weave-core";
  readonly status: "ok";
};

export type RuntimeStatus = {
  readonly name: "mind-weave-core";
  readonly status: "configured";
  readonly sourceCount: number;
  readonly sources: readonly RuntimeSourceStatus[];
  readonly embedding: RuntimeEmbeddingStatus;
  readonly storage: RuntimeStorageStatus;
  readonly observability: RuntimeObservabilityStatus;
  readonly index: RuntimeIndexStatus;
  readonly mcp: RuntimeMcpStatus;
  readonly unavailableCapabilities: readonly RuntimeCapability[];
};

export type RuntimeSourceStatus = Pick<
  SourceDefinition,
  "id" | "type" | "name" | "rootUri" | "status"
>;

export type RuntimeEmbeddingStatus = {
  readonly provider: string;
  readonly model: string;
  readonly dimensions?: number | undefined;
  readonly readiness: RuntimeProviderReadiness;
};

export type RuntimeProviderReadiness = {
  readonly ready: boolean;
  readonly apiKeyEnv: string;
  readonly apiKeyPresent: boolean;
};

export type RuntimeStorageStatus = {
  readonly type: string;
  readonly path: string;
};

export type RuntimeObservabilityStatus = {
  readonly logPath?: string | undefined;
};

export type RuntimeIndexStatus = {
  readonly documents: DocumentStatusCounts;
  readonly chunks: number;
  readonly embeddings: number;
  readonly sources: readonly SourceDocumentStatusCounts[];
};

export type RuntimeMcpStatus = {
  readonly enabled: boolean;
};

export type RuntimeCapability = "start" | "scan" | "query";

export type RuntimeSourceInspection = {
  readonly sourceId: string;
  readonly name: string;
  readonly rootUri: string;
  readonly includedDocumentCount: number;
  readonly skipped: {
    readonly excluded: number;
    readonly ignored: number;
    readonly unsupported: number;
    readonly symlink: number;
  };
  readonly topLevelPathCounts: Record<string, number>;
  readonly sampleIncludedPaths: readonly string[];
  readonly sampleExcludedPaths: readonly string[];
};

export type RuntimeSourceInspectionReport = {
  readonly sources: readonly RuntimeSourceInspection[];
};

export type RuntimeScanProgressEvent =
  | {
    readonly type: "scan.started";
    readonly sourceCount: number;
  }
  | {
    readonly type: "source.scan.started";
    readonly sourceId: string;
  }
  | {
    readonly type: "source.scan.finished";
    readonly sourceId: string;
    readonly candidateCount: number;
  }
  | {
    readonly type: "scan.finished";
    readonly sourceCount: number;
    readonly discoveredDocumentCount: number;
  };

export type RuntimeScanOptions = {
  readonly onProgress?: ((event: RuntimeScanProgressEvent) => void) | undefined;
};

export type AppErrorCode = "APP_CAPABILITY_NOT_AVAILABLE";

export type AppErrorIssue = {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly capability?: RuntimeCapability | undefined;
};

export interface AppRuntime {
  getHealth(): RuntimeHealth;
  getStatus(): Promise<RuntimeStatus>;
  start(): Promise<void>;
  scan(options?: RuntimeScanOptions): Promise<void>;
  inspectSources(): Promise<RuntimeSourceInspectionReport>;
  query(input: string): Promise<readonly QueryResult[]>;
  getMcpToolHandlers(): McpToolHandlers;
  stop(): Promise<void>;
}
