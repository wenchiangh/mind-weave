import { describe, expect, it } from "vitest";
import type { QueryService } from "./contracts.js";

describe("QueryService contract", () => {
  it("returns protocol-neutral chunk results with traceability metadata", async () => {
    const service: QueryService = {
      async search(input) {
        return [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            sourceId: input.includeSourceIds?.[0] ?? "source-1",
            sourceName: "Vault",
            uri: "file:///vault/note.md",
            text: "Relevant chunk",
            score: 0.92,
            documentStatus: "indexed",
            sourceStatus: "active",
            sourceUpdatedAt: 1_717_171_700_000,
            indexedAt: 1_717_171_717_000
          }
        ];
      }
    };

    await expect(
      service.search({ query: "chunk", includeSourceIds: ["source-1"] })
    ).resolves.toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        sourceId: "source-1",
        sourceName: "Vault",
        uri: "file:///vault/note.md",
        text: "Relevant chunk",
        score: 0.92,
        documentStatus: "indexed",
        sourceStatus: "active",
        sourceUpdatedAt: 1_717_171_700_000,
        indexedAt: 1_717_171_717_000
      }
    ]);
  });
});
