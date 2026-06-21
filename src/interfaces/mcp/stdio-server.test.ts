import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import type { QueryResult } from "../../query/contracts.js";
import type { StoredSource } from "../../storage/contracts.js";
import type { McpToolHandlers } from "./tools.js";
import { createMindWeaveMcpServer } from "./stdio-server.js";

const queryResult: QueryResult = {
  chunkId: "chunk-1",
  documentId: "doc-1",
  sourceId: "source-1",
  sourceName: "Vault",
  uri: "file:///vault/note.md",
  relativePath: "note.md",
  chunkIndex: 3,
  text: "Full chunk text",
  score: 0.91,
  documentStatus: "indexed",
  sourceStatus: "active",
  sourceUpdatedAt: 1000,
  indexedAt: 2000,
  metadata: {
    headingPath: ["Project", "Decision"]
  }
};

const source: StoredSource = {
  sourceId: "source-1",
  name: "Vault",
  type: "local-fs",
  rootUri: "file:///vault",
  status: "active",
  lastScannedAt: 3000
};

describe("MindWeave MCP stdio server", () => {
  const clients: Client[] = [];
  const servers: Awaited<ReturnType<typeof createMindWeaveMcpServer>>[] = [];

  afterEach(async () => {
    while (clients.length > 0) {
      await clients.pop()?.close();
    }
    while (servers.length > 0) {
      await servers.pop()?.close();
    }
  });

  it("registers search_knowledge and list_sources over an MCP transport", async () => {
    const { client } = await createConnectedClient(createHandlers());

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "list_sources",
      "search_knowledge"
    ]);
  });

  it("returns search_knowledge handler output as JSON text content", async () => {
    const { client } = await createConnectedClient(createHandlers());

    const result = await client.callTool({
      name: "search_knowledge",
      arguments: {
        query: "topic",
        limit: 3
      }
    });

    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: JSON.stringify({ results: [queryResult] })
        }
      ]
    });
  });

  it("returns list_sources handler output as JSON text content", async () => {
    const { client } = await createConnectedClient(createHandlers());

    const result = await client.callTool({
      name: "list_sources",
      arguments: {}
    });

    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: JSON.stringify({ sources: [source] })
        }
      ]
    });
  });

  it("surfaces thrown handler errors as MCP tool errors", async () => {
    const { client } = await createConnectedClient({
      async searchKnowledge() {
        throw new Error("query failed");
      },
      async listSources() {
        return { sources: [] };
      }
    });

    const result = await client.callTool({
      name: "search_knowledge",
      arguments: {
        query: "topic"
      }
    });

    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          type: "text",
          text: "query failed"
        }
      ]
    });
  });

  async function createConnectedClient(handlers: McpToolHandlers): Promise<{
    readonly client: Client;
  }> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMindWeaveMcpServer({ handlers });
    const client = new Client({
      name: "mind-weave-test-client",
      version: "0.0.0"
    });

    clients.push(client);
    servers.push(server);

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    return { client };
  }
});

function createHandlers(): McpToolHandlers {
  return {
    async searchKnowledge(input) {
      expect(input).toEqual({
        query: "topic",
        limit: 3
      });

      return {
        results: [queryResult]
      };
    },
    async listSources() {
      return {
        sources: [source]
      };
    }
  };
}
