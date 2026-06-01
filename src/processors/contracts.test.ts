import { describe, expect, it } from "vitest";
import type { DocumentProcessor } from "./contracts.js";

describe("DocumentProcessor contract", () => {
  it("converts raw document content into storage-agnostic chunks", async () => {
    const processor: DocumentProcessor = {
      supports: (fileType) => fileType === "text/markdown",
      async process(document) {
        return [
          {
            documentId: document.documentId,
            sourceId: document.sourceId,
            index: 0,
            text: document.content,
            contentHash: "chunk-hash"
          }
        ];
      }
    };

    expect(processor.supports("text/markdown")).toBe(true);
    const chunks = await processor.process({
      documentId: "doc-1",
      sourceId: "source-1",
      uri: "file:///vault/note.md",
      fileType: "text/markdown",
      content: "# Note\n\nBody",
      sourceUpdatedAt: 1_717_171_700_000
    });

    expect(chunks).toEqual([
      {
        documentId: "doc-1",
        sourceId: "source-1",
        index: 0,
        text: "# Note\n\nBody",
        contentHash: "chunk-hash"
      }
    ]);
  });
});
