import type {
  QueryInput,
  QueryResult,
  QueryService
} from "../../query/contracts.js";
import type {
  SourceStatusStore,
  StoredSource
} from "../../storage/contracts.js";

export const mcpToolNames = {
  searchKnowledge: "search_knowledge",
  listSources: "list_sources"
} as const;

export type McpToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required: readonly string[];
    readonly additionalProperties: boolean;
  };
};

export const mcpToolDefinitions: readonly McpToolDefinition[] = [
  {
    name: mcpToolNames.searchKnowledge,
    description: "Search indexed personal knowledge chunks.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        includeSourceIds: {
          type: "array",
          items: { type: "string" }
        },
        excludeSourceIds: {
          type: "array",
          items: { type: "string" }
        },
        fileTypes: {
          type: "array",
          items: { type: "string" }
        },
        scoreThreshold: {
          type: "number",
          minimum: 0,
          maximum: 1
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: mcpToolNames.listSources,
    description: "List configured knowledge sources and their current status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  }
];

export type SearchKnowledgeToolInput = QueryInput;

export type SearchKnowledgeToolOutput = {
  readonly results: readonly QueryResult[];
};

export type ListSourcesToolInput = Record<string, never>;

export type ListSourcesToolOutput = {
  readonly sources: readonly StoredSource[];
};

export type McpToolHandlers = {
  searchKnowledge(input: unknown): Promise<SearchKnowledgeToolOutput>;
  listSources(input: unknown): Promise<ListSourcesToolOutput>;
};

export type McpToolHandlerOptions = {
  readonly queryService: QueryService;
  readonly sourceStore: SourceStatusStore;
};

export function createMcpToolHandlers(options: McpToolHandlerOptions): McpToolHandlers {
  return {
    async searchKnowledge(input: unknown): Promise<SearchKnowledgeToolOutput> {
      return {
        results: await options.queryService.search(parseSearchKnowledgeInput(input))
      };
    },
    async listSources(_input: unknown): Promise<ListSourcesToolOutput> {
      return {
        sources: await options.sourceStore.listSources()
      };
    }
  };
}

function parseSearchKnowledgeInput(input: unknown): SearchKnowledgeToolInput {
  if (!isRecord(input)) {
    throw new Error("search_knowledge input must be an object.");
  }

  const query = input.query;
  if (typeof query !== "string") {
    throw new Error("search_knowledge.query must be a string.");
  }

  const limit = readOptionalNumber(input.limit, "limit");
  const scoreThreshold = readOptionalNumber(input.scoreThreshold, "scoreThreshold");
  if (scoreThreshold !== undefined && (scoreThreshold < 0 || scoreThreshold > 1)) {
    throw new Error("search_knowledge.scoreThreshold must be between 0 and 1.");
  }

  return {
    query,
    ...(limit === undefined ? {} : { limit }),
    ...readOptionalStringArray(input.includeSourceIds, "includeSourceIds"),
    ...readOptionalStringArray(input.excludeSourceIds, "excludeSourceIds"),
    ...readOptionalStringArray(input.fileTypes, "fileTypes"),
    ...(scoreThreshold === undefined ? {} : { scoreThreshold })
  };
}

function readOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`search_knowledge.${fieldName} must be a number.`);
  }

  return value;
}

function readOptionalStringArray(
  value: unknown,
  fieldName: "includeSourceIds" | "excludeSourceIds" | "fileTypes"
): Partial<Pick<QueryInput, typeof fieldName>> {
  if (value === undefined) {
    return {};
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`search_knowledge.${fieldName} must be a string array.`);
  }

  return {
    [fieldName]: value
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
