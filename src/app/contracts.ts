import type { SourceDefinition } from "../sources/contracts.js";
import type { QueryResult } from "../query/contracts.js";
import type { McpToolHandlers } from "../interfaces/mcp/index.js";
import type { DocumentStatusCounts } from "../storage/contracts.js";

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
};

export type RuntimeMcpStatus = {
  readonly enabled: boolean;
};

export type RuntimeCapability = "start" | "scan" | "query";

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
  scan(): Promise<void>;
  query(input: string): Promise<readonly QueryResult[]>;
  getMcpToolHandlers(): McpToolHandlers;
  stop(): Promise<void>;
}
