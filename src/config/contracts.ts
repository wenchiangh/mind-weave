import type { SourceDefinition, SourceId } from "../sources/contracts.js";

export type ConfigSourceType = "local-fs";
export type ConfigEmbeddingProviderType = "openai-compatible";
export type ConfigStorageType = "sqlite";

export type LocalFsSourceConfig = {
  readonly type: "local-fs";
  readonly id?: SourceId | undefined;
  readonly name?: string | undefined;
  readonly rootPath: string;
  readonly exclude?: readonly string[] | undefined;
};

export type OpenAICompatibleEmbeddingConfig = {
  readonly provider: "openai-compatible";
  readonly model: string;
  readonly baseUrl: string;
  readonly apiKey?: string | undefined;
  readonly apiKeyEnv?: string | undefined;
  readonly dimensions?: number | undefined;
  readonly batchSize?: number | undefined;
};

export type SqliteStorageConfig = {
  readonly type: "sqlite";
  readonly path: string;
};

export type McpConfig = {
  readonly enabled?: boolean | undefined;
};

export type UserConfig = {
  readonly sources: readonly LocalFsSourceConfig[];
  readonly embedding: OpenAICompatibleEmbeddingConfig;
  readonly storage: SqliteStorageConfig;
  readonly mcp?: McpConfig | undefined;
};

export type EffectiveLocalFsSourceConfig = {
  readonly type: "local-fs";
  readonly id: SourceId;
  readonly name: string;
  readonly rootPath: string;
  readonly rootUri: string;
  readonly excludePatterns: readonly string[];
  readonly excludeRegexes: readonly RegExp[];
  readonly sourceDefinition: SourceDefinition;
};

export type EffectiveEmbeddingConfig = OpenAICompatibleEmbeddingConfig;
export type EffectiveStorageConfig = SqliteStorageConfig;

export type EffectiveMcpConfig = {
  readonly enabled: boolean;
};

export type EffectiveConfig = {
  readonly sources: readonly EffectiveLocalFsSourceConfig[];
  readonly sourceDefinitions: readonly SourceDefinition[];
  readonly embedding: EffectiveEmbeddingConfig;
  readonly storage: EffectiveStorageConfig;
  readonly mcp: EffectiveMcpConfig;
};

export type ParsedConfigFile = {
  readonly filePath: string;
  readonly baseDir: string;
  readonly data: unknown;
};

export type EffectiveConfigOptions = {
  readonly baseDir: string;
};
