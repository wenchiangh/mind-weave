import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  mcpToolNames,
  type McpToolHandlers
} from "./tools.js";

export type MindWeaveMcpServerOptions = {
  readonly handlers: McpToolHandlers;
};

export type MindWeaveMcpServer = {
  connect(transport: Transport): Promise<void>;
  connectStdio(): Promise<void>;
  close(): Promise<void>;
};

const searchKnowledgeInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  includeSourceIds: z.array(z.string()).optional(),
  excludeSourceIds: z.array(z.string()).optional(),
  fileTypes: z.array(z.string()).optional(),
  scoreThreshold: z.number().min(0).max(1).optional()
});

const listSourcesInputSchema = z.object({});

export function createMindWeaveMcpServer(
  options: MindWeaveMcpServerOptions
): MindWeaveMcpServer {
  const server = new McpServer({
    name: "mind-weave",
    version: "0.0.0"
  });

  server.registerTool(
    mcpToolNames.searchKnowledge,
    {
      description: "Search indexed personal knowledge chunks.",
      inputSchema: searchKnowledgeInputSchema
    },
    async (input) => toJsonTextResult(await options.handlers.searchKnowledge(input))
  );

  server.registerTool(
    mcpToolNames.listSources,
    {
      description: "List configured knowledge sources and their current status.",
      inputSchema: listSourcesInputSchema
    },
    async (input) => toJsonTextResult(await options.handlers.listSources(input))
  );

  return {
    async connect(transport: Transport): Promise<void> {
      await server.connect(transport);
    },
    async connectStdio(): Promise<void> {
      await server.connect(new StdioServerTransport());
    },
    async close(): Promise<void> {
      await server.close();
    }
  };
}

function toJsonTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value)
      }
    ]
  };
}
