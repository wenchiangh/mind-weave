import type { EntityId } from "../shared/contracts.js";
import type { IndexJob, IndexJobStatus } from "./contracts.js";

export type IndexJobHandler = (job: IndexJob) => Promise<void>;

export type InMemoryIndexJobQueueOptions = {
  readonly handler: IndexJobHandler;
  readonly debounceMs?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly retryBackoffMs?: number | undefined;
  readonly createJobId?: (() => EntityId) | undefined;
};

export type IndexQueueErrorKind = "retryable" | "permanent";

export class IndexQueueError extends Error {
  readonly kind: IndexQueueErrorKind;

  constructor(kind: IndexQueueErrorKind, message: string) {
    super(message);
    this.name = "IndexQueueError";
    this.kind = kind;
  }
}

type QueueSettings = {
  readonly debounceMs: number;
  readonly maxRetries: number;
  readonly retryBackoffMs: number;
  readonly createJobId: () => EntityId;
};

type DrainWaiter = {
  readonly resolve: () => void;
};

const defaultSettings = {
  debounceMs: 2000,
  maxRetries: 3,
  retryBackoffMs: 100
};

export class InMemoryIndexJobQueue {
  private readonly handler: IndexJobHandler;
  private readonly settings: QueueSettings;
  private readonly pending = new Map<EntityId, IndexJob>();
  private readonly order: EntityId[] = [];
  private readonly drainWaiters: DrainWaiter[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private runningDocumentId: EntityId | undefined;
  private nextId = 0;

  constructor(options: InMemoryIndexJobQueueOptions) {
    this.handler = options.handler;
    this.settings = {
      debounceMs: options.debounceMs ?? defaultSettings.debounceMs,
      maxRetries: options.maxRetries ?? defaultSettings.maxRetries,
      retryBackoffMs: options.retryBackoffMs ?? defaultSettings.retryBackoffMs,
      createJobId: options.createJobId ?? (() => `index_job_${this.nextId += 1}`)
    };
  }

  async enqueue(job: IndexJob): Promise<void> {
    this.addPending(this.preparePendingJob(job));
    this.scheduleDebounce();
  }

  async drain(): Promise<void> {
    if (this.isIdle()) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.drainWaiters.push({ resolve });
    });
  }

  private preparePendingJob(job: IndexJob): IndexJob {
    return {
      ...job,
      status: "pending",
      attempts: job.attempts
    };
  }

  private addPending(job: IndexJob): void {
    const documentId = job.target.documentId;
    if (!this.pending.has(documentId)) {
      this.order.push(documentId);
    }
    this.pending.set(documentId, job);
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.processNext();
    }, this.settings.debounceMs);
  }

  private async processNext(): Promise<void> {
    if (this.running) {
      return;
    }

    const job = this.shiftNextJob();
    if (job === undefined) {
      this.resolveDrainIfIdle();
      return;
    }

    this.running = true;
    this.runningDocumentId = job.target.documentId;

    await this.runWithRetry({
      ...job,
      status: "running"
    });

    this.running = false;
    this.runningDocumentId = undefined;

    if (this.pending.size > 0) {
      void this.processNext();
      return;
    }

    this.resolveDrainIfIdle();
  }

  private shiftNextJob(): IndexJob | undefined {
    while (this.order.length > 0) {
      const documentId = this.order.shift();
      if (documentId === undefined) {
        continue;
      }

      const job = this.pending.get(documentId);
      if (job === undefined) {
        continue;
      }

      this.pending.delete(documentId);
      return job;
    }

    return undefined;
  }

  private async runWithRetry(job: IndexJob): Promise<void> {
    let current = job;

    while (true) {
      try {
        current = {
          ...current,
          attempts: current.attempts + 1,
          status: "running"
        };
        await this.handler(current);
        return;
      } catch (error) {
        if (!shouldRetry(error) || current.attempts >= this.settings.maxRetries) {
          return;
        }

        await this.waitRetryBackoff();
      }
    }
  }

  private async waitRetryBackoff(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        resolve();
      }, this.settings.retryBackoffMs);
    });
  }

  private isIdle(): boolean {
    return this.pending.size === 0
      && this.order.length === 0
      && !this.running
      && this.debounceTimer === undefined
      && this.retryTimer === undefined;
  }

  private resolveDrainIfIdle(): void {
    if (!this.isIdle()) {
      return;
    }

    while (this.drainWaiters.length > 0) {
      this.drainWaiters.shift()?.resolve();
    }
  }

  getRunningDocumentId(): EntityId | undefined {
    return this.runningDocumentId;
  }

  createJob(input: Omit<IndexJob, "jobId" | "status" | "attempts">): IndexJob {
    return {
      ...input,
      jobId: this.settings.createJobId(),
      status: "pending" satisfies IndexJobStatus,
      attempts: 0
    };
  }
}

export function createRetryableIndexError(message: string): IndexQueueError {
  return new IndexQueueError("retryable", message);
}

export function createPermanentIndexError(message: string): IndexQueueError {
  return new IndexQueueError("permanent", message);
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof IndexQueueError) {
    return error.kind === "retryable";
  }

  return true;
}
