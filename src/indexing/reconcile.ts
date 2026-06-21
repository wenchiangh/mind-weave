import type { UnixMilliseconds } from "../shared/contracts.js";
import { createDocumentId } from "../shared/identity.js";
import type { SourceScanResult } from "../sources/contracts.js";
import type {
  DocumentRegistryStore,
  StoredDocument
} from "../storage/contracts.js";
import type { IndexJob } from "./contracts.js";

export type SourceScanReconcilerOptions = {
  readonly storage: DocumentRegistryStore;
  readonly createJobId?: (document: StoredDocument, index: number) => string;
};

export type DocumentDeleteExecutorOptions = {
  readonly storage: Pick<DocumentRegistryStore, "markDocumentDeleted">;
  readonly now?: (() => UnixMilliseconds) | undefined;
};

export class SourceScanReconciler {
  private readonly storage: DocumentRegistryStore;
  private readonly createJobId: (document: StoredDocument, index: number) => string;

  constructor(options: SourceScanReconcilerOptions) {
    this.storage = options.storage;
    this.createJobId = options.createJobId ?? ((document) =>
      `delete_${document.documentId}`
    );
  }

  async reconcile(scan: SourceScanResult): Promise<readonly IndexJob[]> {
    const activeDocuments = await this.storage.listActiveDocuments(scan.sourceId);
    const currentDocumentIds = new Set(scan.candidates.map((candidate) =>
      createDocumentId(candidate.sourceId, candidate.relativePath ?? candidate.uri)
    ));
    const missingDocuments = activeDocuments.filter((document) =>
      !currentDocumentIds.has(document.documentId)
    );

    return missingDocuments.map((document, index) => ({
      jobId: this.createJobId(document, index),
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
    }));
  }
}

export class DocumentDeleteExecutor {
  private readonly storage: Pick<DocumentRegistryStore, "markDocumentDeleted">;
  private readonly now: () => UnixMilliseconds;

  constructor(options: DocumentDeleteExecutorOptions) {
    this.storage = options.storage;
    this.now = options.now ?? (() => Date.now());
  }

  async deleteJob(job: IndexJob): Promise<void> {
    if (job.type !== "delete-document") {
      throw new Error(`Cannot delete non-delete index job: ${job.type}`);
    }

    await this.deleteDocument(job.target.documentId);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.storage.markDocumentDeleted(documentId, this.now());
  }
}
