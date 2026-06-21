import { mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeEmbeddingProvider } from "../embeddings/fake.js";
import { MarkdownProcessor } from "../processors/markdown.js";
import type { SourceScanResult } from "../sources/contracts.js";
import type { DocumentRegistryStore, StoredDocument } from "../storage/contracts.js";
import { SQLiteStorage } from "../storage/sqlite.js";
import { createDocumentId } from "../shared/identity.js";
import { InMemoryIndexJobQueue } from "./queue.js";
import { DocumentDeleteExecutor, SourceScanReconciler } from "./reconcile.js";
import { DocumentUpsertIndexer } from "./upsert.js";

function createDocument(relativePath: string): StoredDocument {
  return {
    documentId: createDocumentId("source_a", relativePath),
    sourceId: "source_a",
    uri: `file:///notes/${relativePath}`,
    relativePath,
    fileType: "markdown",
    status: "indexed",
    sourceUpdatedAt: 1000,
    indexedAt: 2000
  };
}

function createScanResult(relativePaths: readonly string[]): SourceScanResult {
  return {
    sourceId: "source_a",
    scannedAt: 3000,
    candidates: relativePaths.map((relativePath) => ({
      sourceId: "source_a",
      uri: `file:///notes/${relativePath}`,
      relativePath,
      fileType: "markdown",
      updatedAt: 3000,
      size: 42
    }))
  };
}

class FakeDocumentStore implements DocumentRegistryStore {
  readonly deleted: Array<{ readonly documentId: string; readonly deletedAt: number }> = [];

  constructor(private readonly documents: readonly StoredDocument[]) {}

  async upsertDocument(): Promise<void> {}

  async listActiveDocuments(sourceId: string): Promise<readonly StoredDocument[]> {
    return this.documents.filter((document) =>
      document.sourceId === sourceId && document.status !== "deleted"
    );
  }

  async markDocumentDeleted(documentId: string, deletedAt: number): Promise<void> {
    this.deleted.push({ documentId, deletedAt });
  }
}

describe("SourceScanReconciler", () => {
  it("emits delete jobs for active documents missing from the latest source snapshot", async () => {
    const kept = createDocument("kept.md");
    const missing = createDocument("missing.md");
    const storage = new FakeDocumentStore([kept, missing]);
    const reconciler = new SourceScanReconciler({
      storage,
      createJobId: (_document, index) => `delete_job_${index}`
    });

    const jobs = await reconciler.reconcile(createScanResult(["kept.md"]));

    expect(jobs).toEqual([
      {
        jobId: "delete_job_0",
        type: "delete-document",
        target: {
          documentId: missing.documentId,
          sourceId: "source_a",
          uri: "file:///notes/missing.md",
          relativePath: "missing.md",
          fileType: "markdown",
          updatedAt: 1000
        },
        status: "pending",
        attempts: 0
      }
    ]);
  });

  it("does not emit delete jobs for documents present in the source snapshot", async () => {
    const kept = createDocument("kept.md");
    const storage = new FakeDocumentStore([kept]);
    const reconciler = new SourceScanReconciler({ storage });

    await expect(reconciler.reconcile(createScanResult(["kept.md"]))).resolves.toEqual([]);
  });
});

describe("DocumentDeleteExecutor", () => {
  it("marks delete jobs with the executor timestamp", async () => {
    const document = createDocument("missing.md");
    const storage = new FakeDocumentStore([document]);
    const executor = new DocumentDeleteExecutor({
      storage,
      now: () => 4000
    });

    await executor.deleteJob({
      jobId: "delete_job_0",
      type: "delete-document",
      target: {
        documentId: document.documentId,
        sourceId: document.sourceId,
        uri: document.uri,
        ...(document.relativePath === undefined ? {} : {
          relativePath: document.relativePath
        }),
        fileType: document.fileType,
        updatedAt: document.sourceUpdatedAt
      },
      status: "pending",
      attempts: 0
    });

    expect(storage.deleted).toEqual([
      {
        documentId: document.documentId,
        deletedAt: 4000
      }
    ]);
  });

  it("executes delete jobs reconstructed from a startup-style source scan", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-delete-"));
    const filePath = path.join(directory, "note.md");
    await writeFile(filePath, `# Note

Indexed content.
`);
    const fileStat = await stat(filePath);
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const upsertIndexer = new DocumentUpsertIndexer({
      storage,
      processors: [new MarkdownProcessor()],
      embeddingProvider: new FakeEmbeddingProvider({ dimensions: 8 }),
      now: () => 2000
    });

    await upsertIndexer.upsert({
      sourceId: "source_a",
      uri: pathToFileURL(filePath).href,
      relativePath: "note.md",
      fileType: "markdown",
      updatedAt: 1000,
      size: fileStat.size
    });
    await storage.saveSources([{
      sourceId: "source_a",
      name: "Source A",
      type: "local-fs",
      rootUri: pathToFileURL(directory).href,
      status: "active"
    }]);

    const reconciler = new SourceScanReconciler({ storage });
    const deleteExecutor = new DocumentDeleteExecutor({
      storage,
      now: () => 3000
    });
    const queue = new InMemoryIndexJobQueue({
      debounceMs: 1,
      handler: async (job) => deleteExecutor.deleteJob(job)
    });

    for (const job of await reconciler.reconcile({
      sourceId: "source_a",
      scannedAt: 3000,
      candidates: []
    })) {
      await queue.enqueue(job);
    }
    const drained = queue.drain();
    await drained;

    await expect(storage.listActiveDocuments("source_a")).resolves.toEqual([]);
    await expect(storage.searchVectors({
      vector: await new FakeEmbeddingProvider({ dimensions: 8 }).embedQuery("Indexed content"),
      limit: 10
    })).resolves.toEqual([]);

    storage.close();
  });
});
