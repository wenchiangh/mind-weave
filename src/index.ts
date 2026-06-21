export { getRuntimeHealth } from "./app/runtime.js";
export {
  createRuntime,
  createRuntimeFromConfigFile
} from "./app/runtime.js";
export { AppError, isAppError } from "./app/errors.js";
export type {
  AppErrorCode,
  AppErrorIssue,
  AppRuntime,
  RuntimeCapability,
  RuntimeHealth,
  RuntimeStatus
} from "./app/contracts.js";
export {
  ConfigError,
  createEffectiveConfig,
  isConfigError,
  loadEffectiveConfigFile,
  loadConfigFile,
  parseConfigText,
  validateUserConfig
} from "./config/index.js";
export type {
  ConfigErrorCode,
  ConfigErrorIssue,
  EffectiveConfig,
  EffectiveConfigOptions,
  EffectiveLocalFsSourceConfig,
  LocalFsSourceConfig,
  UserConfig
} from "./config/index.js";
export {
  LocalFsSourceProvider,
  SourceError,
  isSourceError
} from "./sources/index.js";
export type {
  SourceCandidate,
  SourceDefinition,
  SourceErrorCode,
  SourceErrorIssue,
  SourceId,
  SourceProvider,
  SourceScanResult
} from "./sources/index.js";
export {
  createChunkContentHash,
  createChunkId,
  createDocumentFingerprint,
  createDocumentId,
  createGeneratedSourceId,
  documentFingerprintsEqual,
  isSameChunkOccurrenceForPreservation,
  normalizeChunkText,
  normalizeRelativeDocumentPath
} from "./shared/identity.js";
export type {
  ChunkPreservationInput,
  DocumentFingerprint
} from "./shared/identity.js";
export {
  MarkdownProcessor
} from "./processors/index.js";
export type {
  DocumentId,
  ChunkId,
  DocumentProcessor,
  MarkdownProcessorSettings,
  ProcessableDocument,
  ProcessedChunk
} from "./processors/index.js";
export {
  SQLiteStorage,
  StorageError,
  isStorageError
} from "./storage/index.js";
export type {
  ChunkEmbeddingStore,
  DocumentRegistryStore,
  EmbeddingVectorStore,
  IndexConfigStore,
  SourceStatusStore,
  SQLiteStorageOptions,
  StorageErrorCode,
  StorageErrorIssue,
  StoredChunk,
  StoredDocument,
  StoredEmbedding,
  StoredEmbeddingVector,
  StoredSource
} from "./storage/index.js";
export {
  EmbeddingProviderError,
  FakeEmbeddingProvider,
  OpenAICompatibleEmbeddingProvider,
  isEmbeddingProviderError,
  isRetryableKind
} from "./embeddings/index.js";
export type {
  EmbeddingConfigIdentity,
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingProviderErrorKind,
  EmbeddingResult,
  FakeEmbeddingProviderOptions,
  OpenAICompatibleEmbeddingProviderOptions
} from "./embeddings/index.js";
