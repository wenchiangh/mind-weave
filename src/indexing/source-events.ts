import type { UnixMilliseconds } from "../shared/contracts.js";
import { createDocumentId } from "../shared/identity.js";
import type { SourceFileEvent } from "../sources/contracts.js";
import type { IndexingService, IndexJob } from "./contracts.js";

export type SourceEventIndexJobRouterOptions = {
  readonly queue: Pick<IndexingService, "enqueue">;
  readonly createJobId?: (() => string) | undefined;
  readonly now?: (() => UnixMilliseconds) | undefined;
};

export class SourceEventIndexJobRouter {
  private nextJobId = 0;
  private readonly queue: Pick<IndexingService, "enqueue">;
  private readonly createJobId: () => string;
  private readonly now: () => UnixMilliseconds;

  constructor(options: SourceEventIndexJobRouterOptions) {
    this.queue = options.queue;
    this.createJobId = options.createJobId ?? (() => `source_event_job_${this.nextJobId += 1}`);
    this.now = options.now ?? (() => Date.now());
  }

  async route(event: SourceFileEvent): Promise<void> {
    await this.queue.enqueue(this.createJob(event));
  }

  createJob(event: SourceFileEvent): IndexJob {
    if (event.type === "upsert") {
      const relativePath = event.candidate.relativePath ?? event.candidate.uri;
      return {
        jobId: this.createJobId(),
        type: "upsert-document",
        target: {
          documentId: createDocumentId(event.candidate.sourceId, relativePath),
          sourceId: event.candidate.sourceId,
          uri: event.candidate.uri,
          ...(event.candidate.relativePath === undefined ? {} : {
            relativePath: event.candidate.relativePath
          }),
          fileType: event.candidate.fileType,
          updatedAt: event.candidate.updatedAt,
          size: event.candidate.size
        },
        status: "pending",
        attempts: 0
      };
    }

    const relativePath = event.target.relativePath ?? event.target.uri;
    return {
      jobId: this.createJobId(),
      type: "delete-document",
      target: {
        documentId: createDocumentId(event.target.sourceId, relativePath),
        sourceId: event.target.sourceId,
        uri: event.target.uri,
        ...(event.target.relativePath === undefined ? {} : {
          relativePath: event.target.relativePath
        }),
        fileType: event.target.fileType,
        updatedAt: this.now()
      },
      status: "pending",
      attempts: 0
    };
  }
}
