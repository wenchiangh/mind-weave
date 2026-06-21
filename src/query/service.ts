import type { EmbeddingProvider } from "../embeddings/contracts.js";
import type { VectorSearchStore } from "../storage/contracts.js";
import type {
  QueryInput,
  QueryResult,
  QueryService
} from "./contracts.js";

const defaultLimit = 8;
const maxLimit = 50;

export type CoreQueryServiceOptions = {
  readonly embeddingProvider: EmbeddingProvider;
  readonly storage: VectorSearchStore;
};

export class CoreQueryService implements QueryService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly storage: VectorSearchStore;

  constructor(options: CoreQueryServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.storage = options.storage;
  }

  async search(input: QueryInput): Promise<readonly QueryResult[]> {
    const normalized = normalizeInput(input);
    const vector = await this.embeddingProvider.embedQuery(normalized.query);
    const results = await this.storage.searchVectors({
      vector,
      limit: normalized.limit,
      ...(normalized.includeSourceIds === undefined ? {} : {
        includeSourceIds: normalized.includeSourceIds
      }),
      ...(normalized.excludeSourceIds === undefined ? {} : {
        excludeSourceIds: normalized.excludeSourceIds
      }),
      ...(normalized.fileTypes === undefined ? {} : { fileTypes: normalized.fileTypes }),
      ...(normalized.scoreThreshold === undefined ? {} : {
        scoreThreshold: normalized.scoreThreshold
      })
    });

    return results.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      uri: result.uri,
      ...(result.relativePath === undefined ? {} : { relativePath: result.relativePath }),
      chunkIndex: result.chunkIndex,
      text: result.text,
      score: result.score,
      documentStatus: result.documentStatus,
      sourceStatus: result.sourceStatus,
      sourceUpdatedAt: result.sourceUpdatedAt,
      indexedAt: result.indexedAt,
      ...(result.metadata === undefined ? {} : { metadata: result.metadata })
    }));
  }
}

type NormalizedQueryInput = Required<Pick<QueryInput, "query" | "limit">>
  & Omit<QueryInput, "query" | "limit">;

function normalizeInput(input: QueryInput): NormalizedQueryInput {
  const query = input.query.trim();
  if (query.length === 0) {
    throw new Error("Query text is required.");
  }

  const limit = input.limit ?? defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new Error("Query limit must be between 1 and 50.");
  }

  return {
    query,
    limit,
    ...(input.includeSourceIds === undefined ? {} : {
      includeSourceIds: input.includeSourceIds
    }),
    ...(input.excludeSourceIds === undefined ? {} : {
      excludeSourceIds: input.excludeSourceIds
    }),
    ...(input.fileTypes === undefined ? {} : { fileTypes: input.fileTypes }),
    ...(input.scoreThreshold === undefined ? {} : {
      scoreThreshold: input.scoreThreshold
    })
  };
}
