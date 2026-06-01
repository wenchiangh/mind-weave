import type {
  EntityId,
  MetadataRecord,
  Vector
} from "../shared/contracts.js";

export type EmbeddingConfigIdentity = {
  readonly provider: string;
  readonly model: string;
  readonly dimensions?: number;
};

export type EmbeddingInput = {
  readonly id: EntityId;
  readonly text: string;
  readonly metadata?: MetadataRecord;
};

export type EmbeddingResult = {
  readonly inputId: EntityId;
  readonly vector: Vector;
  readonly config: EmbeddingConfigIdentity;
};

export type EmbeddingProviderErrorKind =
  | "configuration"
  | "authentication"
  | "rate-limit"
  | "transient"
  | "invalid-request";

export interface EmbeddingProvider {
  getConfig(): EmbeddingConfigIdentity;
  embedDocuments(inputs: readonly EmbeddingInput[]): Promise<readonly EmbeddingResult[]>;
  embedQuery(text: string): Promise<Vector>;
}
