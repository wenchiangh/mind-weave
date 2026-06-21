import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FakeEmbeddingProvider } from "../embeddings/fake.js";
import { createMindWeaveMcpServer } from "../interfaces/mcp/index.js";
import { createRuntimeFromConfigFile } from "./runtime.js";

async function createFixture(): Promise<{
  readonly configPath: string;
  readonly notesPath: string;
  readonly notePath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-e2e-"));
  const notesPath = path.join(directory, "notes");
  const notePath = path.join(notesPath, "note.md");
  const configPath = path.join(directory, "mind-weave.jsonc");
  await mkdir(notesPath, { recursive: true });
  await writeFile(notePath, `# Project

Alpha planning note.
`);
  await writeFile(configPath, `{
    "sources": [
      {
        "type": "local-fs",
        "id": "notes",
        "name": "Notes",
        "rootPath": "./notes"
      }
    ],
    "embedding": {
      "provider": "openai-compatible",
      "model": "fake-query",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY",
      "dimensions": 8
    },
    "storage": {
      "type": "sqlite",
      "path": "./mind-weave.sqlite"
    },
    "mcp": {
      "enabled": true
    }
  }`);

  return {
    configPath,
    notesPath,
    notePath
  };
}

describe("runtime end-to-end core loop", () => {
  it("scans, indexes, queries, exposes MCP search, updates edits, and reconciles deletes", async () => {
    const { configPath, notePath } = await createFixture();
    const runtime = await createRuntimeFromConfigFile(configPath, {
      embeddingProvider: new FakeEmbeddingProvider({
        provider: "fake",
        model: "fake-query",
        dimensions: 8
      })
    });

    await runtime.scan();

    const firstResults = await runtime.query("Alpha planning");
    expect(firstResults[0]).toMatchObject({
      sourceId: "notes",
      sourceName: "Notes",
      uri: expect.stringContaining("note.md"),
      text: expect.stringContaining("Alpha planning note"),
      documentStatus: "indexed",
      sourceStatus: "active"
    });

    const mcpOutput = await runtime.getMcpToolHandlers().searchKnowledge({
      query: "Alpha planning",
      limit: 5
    });
    expect(mcpOutput.results[0]?.text).toContain("Alpha planning note");

    const { client, server } = await createMcpClient(runtime.getMcpToolHandlers());
    try {
      const clientSearchOutput = parseSearchToolJson(await client.callTool({
        name: "search_knowledge",
        arguments: {
          query: "Alpha planning",
          limit: 5
        }
      }));
      expect(clientSearchOutput.results[0]).toMatchObject({
        sourceId: "notes",
        sourceName: "Notes",
        uri: expect.stringContaining("note.md"),
        text: expect.stringContaining("Alpha planning note"),
        score: expect.any(Number),
        documentStatus: "indexed",
        sourceStatus: "active",
        sourceUpdatedAt: expect.any(Number),
        indexedAt: expect.any(Number)
      });
      expect(clientSearchOutput.results[0]?.chunkId).toEqual(expect.any(String));
      expect(clientSearchOutput.results[0]?.documentId).toEqual(expect.any(String));

      const clientSourcesOutput = parseSourcesToolJson(await client.callTool({
        name: "list_sources",
        arguments: {}
      }));
      expect(clientSourcesOutput.sources).toEqual([
        expect.objectContaining({
          sourceId: "notes",
          name: "Notes",
          type: "local-fs",
          status: "active"
        })
      ]);
    } finally {
      await client.close();
      await server.close();
    }

    await writeFile(notePath, `# Project

Beta revised note.
`);
    await runtime.scan();
    const editedResults = await runtime.query("Beta revised");
    expect(editedResults[0]?.text).toContain("Beta revised note");

    await rm(notePath);
    await runtime.scan();
    await expect(runtime.query("Beta revised")).resolves.toEqual([]);

    await runtime.stop();
  });
});

async function createMcpClient(
  handlers: ReturnType<Awaited<ReturnType<typeof createRuntimeFromConfigFile>>["getMcpToolHandlers"]>
): Promise<{
  readonly client: Client;
  readonly server: ReturnType<typeof createMindWeaveMcpServer>;
}> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMindWeaveMcpServer({ handlers });
  const client = new Client({
    name: "mind-weave-e2e-client",
    version: "0.0.0"
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  return {
    client,
    server
  };
}

function parseSearchToolJson(result: unknown): {
  readonly results: readonly Record<string, unknown>[];
} {
  const output = parseToolJson(result) as {
    readonly results?: readonly Record<string, unknown>[];
  };

  if (output.results === undefined) {
    throw new Error("Expected search_knowledge output to include results.");
  }

  return {
    results: output.results
  };
}

function parseSourcesToolJson(result: unknown): {
  readonly sources: readonly Record<string, unknown>[];
} {
  const output = parseToolJson(result) as {
    readonly sources?: readonly Record<string, unknown>[];
  };

  if (output.sources === undefined) {
    throw new Error("Expected list_sources output to include sources.");
  }

  return {
    sources: output.sources
  };
}

function parseToolJson(result: unknown): unknown {
  const content = (result as { readonly content?: readonly unknown[] }).content;
  const firstContent = content?.[0] as { readonly type?: string; readonly text?: string } | undefined;

  if (firstContent?.type !== "text" || firstContent.text === undefined) {
    throw new Error("Expected MCP tool result to contain JSON text content.");
  }

  return JSON.parse(firstContent.text);
}
