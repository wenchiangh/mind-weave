import { describe, expect, it } from "vitest";
import type { QueryInput, QueryResult, QueryService } from "../../query/contracts.js";
import type { SourceStatusStore, StoredSource } from "../../storage/contracts.js";
import { createMcpToolHandlers, mcpToolDefinitions } from "./tools.js";

class CapturingQueryService implements QueryService {
  inputs: QueryInput[] = [];

  constructor(private readonly results: readonly QueryResult[] = []) {}

  async search(input: QueryInput): Promise<readonly QueryResult[]> {
    this.inputs.push(input);
    return this.results;
  }
}

class FakeSourceStore implements SourceStatusStore {
  constructor(private readonly sources: readonly StoredSource[]) {}

  async saveSources(): Promise<void> {}

  async listSources(): Promise<readonly StoredSource[]> {
    return this.sources;
  }
}

const queryResult: QueryResult = {
  chunkId: "chunk-1",
  documentId: "doc-1",
  sourceId: "source-1",
  sourceName: "Vault",
  uri: "file:///vault/note.md",
  text: "Full chunk text",
  score: 0.91,
  documentStatus: "indexed",
  sourceStatus: "active",
  sourceUpdatedAt: 1000,
  indexedAt: 2000,
  metadata: {
    section: "Intro"
  }
};

describe("MCP tool handlers", () => {
  it("exposes MCP tool definitions with input schemas", () => {
    expect(mcpToolDefinitions).toMatchObject([
      {
        name: "search_knowledge",
        inputSchema: {
          type: "object",
          required: ["query"]
        }
      },
      {
        name: "list_sources",
        inputSchema: {
          type: "object",
          required: []
        }
      }
    ]);
  });

  it("forwards search_knowledge input to QueryService and returns full chunk payloads", async () => {
    const queryService = new CapturingQueryService([queryResult]);
    const handlers = createMcpToolHandlers({
      queryService,
      sourceStore: new FakeSourceStore([])
    });

    const output = await handlers.searchKnowledge({
      query: "topic",
      limit: 5,
      includeSourceIds: ["source-1"],
      excludeSourceIds: ["source-2"],
      fileTypes: ["markdown"],
      scoreThreshold: 0.7
    });

    expect(queryService.inputs).toEqual([
      {
        query: "topic",
        limit: 5,
        includeSourceIds: ["source-1"],
        excludeSourceIds: ["source-2"],
        fileTypes: ["markdown"],
        scoreThreshold: 0.7
      }
    ]);
    expect(output).toEqual({
      results: [queryResult]
    });
  });

  it("returns empty results for successful no-match searches", async () => {
    const handlers = createMcpToolHandlers({
      queryService: new CapturingQueryService([]),
      sourceStore: new FakeSourceStore([])
    });

    await expect(handlers.searchKnowledge({ query: "missing" })).resolves.toEqual({
      results: []
    });
  });

  it("rejects invalid search_knowledge input before calling QueryService", async () => {
    const queryService = new CapturingQueryService([]);
    const handlers = createMcpToolHandlers({
      queryService,
      sourceStore: new FakeSourceStore([])
    });

    await expect(handlers.searchKnowledge({})).rejects.toThrow(
      "search_knowledge.query must be a string."
    );
    await expect(handlers.searchKnowledge({ query: "topic", scoreThreshold: 2 })).rejects.toThrow(
      "search_knowledge.scoreThreshold must be between 0 and 1."
    );
    await expect(handlers.searchKnowledge({
      query: "topic",
      includeSourceIds: ["source-1", 1]
    })).rejects.toThrow("search_knowledge.includeSourceIds must be a string array.");
    expect(queryService.inputs).toEqual([]);
  });

  it("propagates QueryService errors as tool errors", async () => {
    const queryService: QueryService = {
      async search(): Promise<readonly QueryResult[]> {
        throw new Error("query failed");
      }
    };
    const handlers = createMcpToolHandlers({
      queryService,
      sourceStore: new FakeSourceStore([])
    });

    await expect(handlers.searchKnowledge({ query: "topic" })).rejects.toThrow("query failed");
  });

  it("returns list_sources output through SourceStatusStore", async () => {
    const handlers = createMcpToolHandlers({
      queryService: new CapturingQueryService([]),
      sourceStore: new FakeSourceStore([
        {
          sourceId: "source-1",
          name: "Vault",
          type: "local-fs",
          rootUri: "file:///vault",
          status: "active",
          lastScannedAt: 1000
        },
        {
          sourceId: "source-2",
          name: "Archive",
          type: "local-fs",
          rootUri: "file:///archive",
          status: "error",
          lastError: "scan failed"
        }
      ])
    });

    await expect(handlers.listSources({})).resolves.toEqual({
      sources: [
        {
          sourceId: "source-1",
          name: "Vault",
          type: "local-fs",
          rootUri: "file:///vault",
          status: "active",
          lastScannedAt: 1000
        },
        {
          sourceId: "source-2",
          name: "Archive",
          type: "local-fs",
          rootUri: "file:///archive",
          status: "error",
          lastError: "scan failed"
        }
      ]
    });
  });
});
