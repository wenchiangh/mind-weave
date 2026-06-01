import { describe, expect, it } from "vitest";
import type {
  SourceDefinition,
  SourceProvider,
  SourceScanResult
} from "./contracts.js";

describe("SourceProvider contract", () => {
  it("describes source discovery without reading document content", async () => {
    const provider: SourceProvider = {
      async scan(source: SourceDefinition): Promise<SourceScanResult> {
        return {
          sourceId: source.id,
          scannedAt: 1_717_171_717_000,
          candidates: [
            {
              sourceId: source.id,
              uri: "file:///vault/note.md",
              relativePath: "note.md",
              fileType: "text/markdown",
              updatedAt: 1_717_171_700_000,
              size: 128
            }
          ]
        };
      }
    };

    const result = await provider.scan({
      id: "source-1",
      type: "local-fs",
      name: "Vault",
      rootUri: "file:///vault",
      status: "active"
    });

    expect(result.candidates[0]).toMatchObject({
      sourceId: "source-1",
      relativePath: "note.md",
      fileType: "text/markdown"
    });
    expect(result.candidates[0]).not.toHaveProperty("content");
  });
});
