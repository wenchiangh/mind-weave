import { afterEach, describe, expect, it, vi } from "vitest";
import type { IndexDocumentTarget, IndexJob, IndexJobType } from "./contracts.js";
import {
  InMemoryIndexJobQueue,
  createPermanentIndexError,
  createRetryableIndexError
} from "./queue.js";

function createTarget(documentId: string): IndexDocumentTarget {
  return {
    documentId,
    sourceId: "source_a",
    uri: `file:///notes/${documentId}.md`,
    relativePath: `${documentId}.md`,
    fileType: "markdown",
    updatedAt: 1000,
    size: 42
  };
}

function createJob(type: IndexJobType, documentId: string, updatedAt = 1000): IndexJob {
  return {
    jobId: `${type}_${documentId}_${updatedAt}`,
    type,
    target: {
      ...createTarget(documentId),
      updatedAt
    },
    status: "pending",
    attempts: 0
  };
}

async function flushDebounce(ms = 10): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("InMemoryIndexJobQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces same-document pending upserts with latest target", async () => {
    vi.useFakeTimers();
    const executed: IndexJob[] = [];
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      handler: async (job) => {
        executed.push(job);
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_a", 1000));
    await queue.enqueue(createJob("upsert-document", "doc_a", 2000));

    const drained = queue.drain();
    await flushDebounce();
    await drained;

    expect(executed).toHaveLength(1);
    expect(executed[0]?.type).toBe("upsert-document");
    expect(executed[0]?.target.updatedAt).toBe(2000);
  });

  it("lets delete override pending upsert and later upsert replace pending delete", async () => {
    vi.useFakeTimers();
    const executed: IndexJob[] = [];
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      handler: async (job) => {
        executed.push(job);
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_a", 1000));
    await queue.enqueue(createJob("delete-document", "doc_a", 1001));
    await queue.enqueue(createJob("upsert-document", "doc_a", 1002));

    const drained = queue.drain();
    await flushDebounce();
    await drained;

    expect(executed).toHaveLength(1);
    expect(executed[0]?.type).toBe("upsert-document");
    expect(executed[0]?.target.updatedAt).toBe(1002);
  });

  it("executes different documents in deterministic FIFO order", async () => {
    vi.useFakeTimers();
    const executed: string[] = [];
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      handler: async (job) => {
        executed.push(job.target.documentId);
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_b"));
    await queue.enqueue(createJob("upsert-document", "doc_a"));

    const drained = queue.drain();
    await flushDebounce();
    await drained;

    expect(executed).toEqual(["doc_b", "doc_a"]);
  });

  it("does not cancel running jobs and runs same-document follow-up afterward", async () => {
    vi.useFakeTimers();
    const executed: Array<{
      readonly documentId: string;
      readonly updatedAt: number;
    }> = [];
    let releaseFirst: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      handler: async (job) => {
        const isFirstRun = executed.length === 0;
        executed.push({
          documentId: job.target.documentId,
          updatedAt: job.target.updatedAt
        });

        if (isFirstRun) {
          markFirstStarted?.();
          await new Promise<void>((release) => {
            releaseFirst = release;
          });
        }
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_a", 1000));
    await flushDebounce();
    await firstStarted;
    await queue.enqueue(createJob("upsert-document", "doc_a", 2000));
    const drained = queue.drain();
    releaseFirst?.();
    await vi.runAllTimersAsync();
    await drained;

    expect(executed).toEqual([
      { documentId: "doc_a", updatedAt: 1000 },
      { documentId: "doc_a", updatedAt: 2000 }
    ]);
  });

  it("retries retryable failures up to maxRetries", async () => {
    vi.useFakeTimers();
    const attempts: number[] = [];
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      retryBackoffMs: 10,
      maxRetries: 3,
      handler: async (job) => {
        attempts.push(job.attempts);
        if (attempts.length < 3) {
          throw createRetryableIndexError("try again");
        }
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_a"));
    const drained = queue.drain();
    await vi.runAllTimersAsync();
    await drained;

    expect(attempts).toEqual([1, 2, 3]);
  });

  it("does not retry permanent failures and continues later jobs", async () => {
    vi.useFakeTimers();
    const executed: string[] = [];
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 10,
      retryBackoffMs: 10,
      maxRetries: 3,
      handler: async (job) => {
        executed.push(job.target.documentId);
        if (job.target.documentId === "doc_a") {
          throw createPermanentIndexError("do not retry");
        }
      }
    });

    await queue.enqueue(createJob("upsert-document", "doc_a"));
    await queue.enqueue(createJob("upsert-document", "doc_b"));
    const drained = queue.drain();
    await vi.runAllTimersAsync();
    await drained;

    expect(executed).toEqual(["doc_a", "doc_b"]);
  });

  it("creates queue-owned pending jobs", () => {
    const queue = new InMemoryIndexJobQueue({
      handler: async () => {},
      createJobId: () => "job_1"
    });

    expect(queue.createJob({
      type: "delete-document",
      target: createTarget("doc_a")
    })).toEqual({
      jobId: "job_1",
      type: "delete-document",
      target: createTarget("doc_a"),
      status: "pending",
      attempts: 0
    });
  });
});
