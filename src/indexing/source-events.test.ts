import { describe, expect, it } from "vitest";
import type { IndexJob } from "./contracts.js";
import { SourceEventIndexJobRouter } from "./source-events.js";
import { createDocumentId } from "../shared/identity.js";
import type { SourceFileEvent } from "../sources/contracts.js";

class FakeQueue {
  readonly jobs: IndexJob[] = [];

  async enqueue(job: IndexJob): Promise<void> {
    this.jobs.push(job);
  }
}

const upsertEvent: SourceFileEvent = {
  type: "upsert",
  candidate: {
    sourceId: "source_a",
    uri: "file:///vault/note.md",
    relativePath: "note.md",
    fileType: "markdown",
    updatedAt: 1000,
    size: 42
  }
};

const deleteEvent: SourceFileEvent = {
  type: "delete",
  target: {
    sourceId: "source_a",
    uri: "file:///vault/note.md",
    relativePath: "note.md",
    fileType: "markdown"
  }
};

describe("SourceEventIndexJobRouter", () => {
  it("routes upsert source events into upsert-document jobs", async () => {
    const queue = new FakeQueue();
    const router = new SourceEventIndexJobRouter({
      queue,
      createJobId: () => "job_1",
      now: () => 2000
    });

    await router.route(upsertEvent);

    expect(queue.jobs).toEqual([
      {
        jobId: "job_1",
        type: "upsert-document",
        target: {
          documentId: createDocumentId("source_a", "note.md"),
          sourceId: "source_a",
          uri: "file:///vault/note.md",
          relativePath: "note.md",
          fileType: "markdown",
          updatedAt: 1000,
          size: 42
        },
        status: "pending",
        attempts: 0
      }
    ]);
  });

  it("routes delete source events into delete-document jobs", async () => {
    const queue = new FakeQueue();
    const router = new SourceEventIndexJobRouter({
      queue,
      createJobId: () => "job_2",
      now: () => 2000
    });

    await router.route(deleteEvent);

    expect(queue.jobs).toEqual([
      {
        jobId: "job_2",
        type: "delete-document",
        target: {
          documentId: createDocumentId("source_a", "note.md"),
          sourceId: "source_a",
          uri: "file:///vault/note.md",
          relativePath: "note.md",
          fileType: "markdown",
          updatedAt: 2000
        },
        status: "pending",
        attempts: 0
      }
    ]);
  });
});
