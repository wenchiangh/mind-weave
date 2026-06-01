import { describe, expect, it } from "vitest";
import type { IndexJob, IndexingService } from "./contracts.js";

describe("IndexingService contract", () => {
  it("accepts upsert and delete job intent without watcher or storage details", async () => {
    const accepted: IndexJob[] = [];
    const service: IndexingService = {
      enqueue: async (job) => {
        accepted.push(job);
      },
      drain: async () => undefined
    };

    await service.enqueue({
      jobId: "job-1",
      type: "upsert-document",
      target: {
        documentId: "doc-1",
        sourceId: "source-1",
        uri: "file:///vault/note.md",
        relativePath: "note.md",
        fileType: "text/markdown",
        updatedAt: 1_717_171_700_000,
        size: 128
      },
      status: "pending",
      attempts: 0
    });
    await service.drain();

    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.type).toBe("upsert-document");
  });
});
