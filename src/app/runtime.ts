import type { EffectiveConfig } from "../config/index.js";
import { loadEffectiveConfigFile } from "../config/index.js";
import type { EmbeddingProvider } from "../embeddings/index.js";
import { OpenAICompatibleEmbeddingProvider } from "../embeddings/index.js";
import {
  DocumentDeleteExecutor,
  DocumentUpsertIndexer,
  InMemoryIndexJobQueue,
  SourceEventIndexJobRouter,
  SourceScanReconciler
} from "../indexing/index.js";
import type { IndexJob } from "../indexing/index.js";
import { createMcpToolHandlers } from "../interfaces/mcp/index.js";
import type { McpToolHandlers } from "../interfaces/mcp/index.js";
import { MarkdownProcessor } from "../processors/index.js";
import { CoreQueryService } from "../query/index.js";
import type { QueryResult } from "../query/index.js";
import { createDocumentId } from "../shared/identity.js";
import {
  createDefaultLogFilePath,
  FileLogger,
  type Logger
} from "../observability/index.js";
import {
  LocalFsSourceProvider,
  LocalFsSourceWatcher
} from "../sources/index.js";
import type {
  SourceDefinition,
  SourceInspector,
  SourceProvider,
  SourceWatcher
} from "../sources/index.js";
import { SQLiteStorage } from "../storage/index.js";
import type { SQLiteStorageOptions } from "../storage/index.js";
import type {
  AppRuntime,
  RuntimeHealth,
  RuntimeConfigInfo,
  RuntimeScanOptions,
  RuntimeScanProgressEvent,
  RuntimeSourceInspection,
  RuntimeStatus,
  RuntimeWatchStatus
} from "./contracts.js";

export type RuntimeDependencyOptions = {
  readonly embeddingProvider?: EmbeddingProvider | undefined;
  readonly storage?: SQLiteStorage | undefined;
  readonly sourceProvider?: SourceProvider | undefined;
  readonly createWatcher?: ((source: SourceDefinition) => SourceWatcher) | undefined;
  readonly logger?: Logger | undefined;
  readonly configPath?: string | undefined;
};

export function getRuntimeHealth(): RuntimeHealth {
  return {
    name: "mind-weave-core",
    status: "ok"
  };
}

export async function createRuntimeFromConfigFile(
  configPath: string,
  options: RuntimeDependencyOptions = {}
): Promise<AppRuntime> {
  return createRuntime(await loadEffectiveConfigFile(configPath), {
    ...options,
    configPath
  });
}

export function createRuntime(
  config: EffectiveConfig,
  options: RuntimeDependencyOptions = {}
): AppRuntime {
  return new ConfiguredAppRuntime(config, options);
}

class ConfiguredAppRuntime implements AppRuntime {
  private readonly storage: SQLiteStorage;
  private readonly ownsStorage: boolean;
  private readonly sourceProvider: SourceProvider;
  private readonly sourceInspector: SourceInspector;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly upsertIndexer: DocumentUpsertIndexer;
  private readonly deleteExecutor: DocumentDeleteExecutor;
  private readonly queue: InMemoryIndexJobQueue;
  private readonly sourceEventRouter: SourceEventIndexJobRouter;
  private readonly queryService: CoreQueryService;
  private readonly mcpHandlers: McpToolHandlers;
  private readonly createWatcher: (source: SourceDefinition) => SourceWatcher;
  private readonly configPath: string | undefined;
  private readonly logger: Logger;
  private readonly watchers: SourceWatcher[] = [];
  private watchStatus: RuntimeWatchStatus = {
    status: "stopped",
    watcherCount: 0
  };

  constructor(
    private readonly config: EffectiveConfig,
    options: RuntimeDependencyOptions
  ) {
    this.embeddingProvider = options.embeddingProvider
      ?? new OpenAICompatibleEmbeddingProvider(config.embedding);
    this.storage = options.storage ?? new SQLiteStorage(
      config.storage.path,
      createSQLiteOptions(this.embeddingProvider)
    );
    this.logger = options.logger ?? new FileLogger(
      createDefaultLogFilePath(config.storage.path)
    );
    this.configPath = options.configPath;
    this.ownsStorage = options.storage === undefined;
    this.sourceProvider = options.sourceProvider ?? new LocalFsSourceProvider();
    this.sourceInspector = isSourceInspector(this.sourceProvider)
      ? this.sourceProvider
      : createUnsupportedSourceInspector();
    this.upsertIndexer = new DocumentUpsertIndexer({
      storage: this.storage,
      processors: [new MarkdownProcessor()],
      embeddingProvider: this.embeddingProvider
    });
    this.deleteExecutor = new DocumentDeleteExecutor({
      storage: this.storage
    });
    this.queue = new InMemoryIndexJobQueue({
      debounceMs: 1,
      handler: async (job) => this.handleIndexJob(job)
    });
    this.sourceEventRouter = new SourceEventIndexJobRouter({
      queue: this.queue
    });
    this.queryService = new CoreQueryService({
      embeddingProvider: this.embeddingProvider,
      storage: this.storage
    });
    this.mcpHandlers = createMcpToolHandlers({
      queryService: this.queryService,
      sourceStore: this.storage
    });
    this.createWatcher = options.createWatcher ?? ((source) =>
      new LocalFsSourceWatcher({
        source,
        onEvent: async (event) => {
          await this.sourceEventRouter.route(event);
        }
      })
    );
  }

  getHealth(): RuntimeHealth {
    return getRuntimeHealth();
  }

  async getStatus(): Promise<RuntimeStatus> {
    const configInfo = await this.getConfigInfo();
    return {
      name: "mind-weave-core",
      status: "configured",
      sourceCount: this.config.sourceDefinitions.length,
      sources: this.config.sourceDefinitions.map((source) => ({
        id: source.id,
        type: source.type,
        name: source.name,
        rootUri: source.rootUri,
        status: source.status
      })),
      config: configInfo,
      embedding: {
        provider: this.config.embedding.provider,
        model: this.config.embedding.model,
        dimensions: this.config.embedding.dimensions,
        readiness: createProviderReadiness(this.config.embedding)
      },
      storage: {
        type: this.config.storage.type,
        path: this.config.storage.path
      },
      observability: {
        logPath: this.logger.logPath
      },
      index: {
        documents: await this.storage.countDocumentsByStatus(),
        ...await this.storage.readIndexStats()
      },
      watch: this.watchStatus,
      mcp: this.createMcpStatus(),
      unavailableCapabilities: []
    };
  }

  async getConfigInfo(): Promise<RuntimeConfigInfo> {
    return {
      ...(this.configPath === undefined ? {} : { path: this.configPath }),
      sources: this.config.sourceDefinitions.map((source) => ({
        id: source.id,
        type: source.type,
        name: source.name,
        rootUri: source.rootUri,
        status: source.status
      })),
      embedding: {
        provider: this.config.embedding.provider,
        model: this.config.embedding.model,
        baseUrl: this.config.embedding.baseUrl,
        ...(this.config.embedding.apiKeyEnv === undefined
          ? {}
          : { apiKeyEnv: this.config.embedding.apiKeyEnv }),
        dimensions: this.config.embedding.dimensions
      },
      storage: {
        type: this.config.storage.type,
        path: this.config.storage.path
      },
      observability: {
        logPath: this.logger.logPath
      }
    };
  }

  async start(): Promise<void> {
    await this.logInfo("runtime.starting", {
      sourceCount: this.config.sourceDefinitions.length
    });
    await this.scan();
    await this.startWatching();
    await this.logInfo("runtime.started", {
      watcherCount: this.watchers.length
    });
  }

  async startWatching(): Promise<void> {
    if (this.watchStatus.status === "running") {
      return;
    }

    this.watchStatus = {
      status: "starting",
      watcherCount: this.watchers.length
    };

    try {
      for (const source of this.config.sourceDefinitions) {
        const watcher = this.createWatcher(source);
        await watcher.start();
        this.watchers.push(watcher);
      }

      this.watchStatus = {
        status: "running",
        watcherCount: this.watchers.length
      };
    } catch (error) {
      while (this.watchers.length > 0) {
        await this.watchers.pop()?.stop();
      }

      this.watchStatus = {
        status: "error",
        watcherCount: 0,
        lastError: errorMessage(error)
      };
      throw error;
    }
  }

  async stopWatching(): Promise<void> {
    if (this.watchers.length === 0) {
      this.watchStatus = {
        status: "stopped",
        watcherCount: 0
      };
      return;
    }

    this.watchStatus = {
      status: "stopping",
      watcherCount: this.watchers.length
    };

    while (this.watchers.length > 0) {
      await this.watchers.pop()?.stop();
    }

    this.watchStatus = {
      status: "stopped",
      watcherCount: 0
    };
  }

  async scan(options: RuntimeScanOptions = {}): Promise<void> {
    const startedEvent: RuntimeScanProgressEvent = {
      type: "scan.started",
      sourceCount: this.config.sourceDefinitions.length
    };
    emitProgress(options, startedEvent);
    await this.logInfo(startedEvent.type, {
      sourceCount: startedEvent.sourceCount
    });

    try {
      await this.storage.saveSources(this.config.sourceDefinitions.map((source) => ({
        sourceId: source.id,
        name: source.name,
        type: source.type,
        rootUri: source.rootUri,
        status: source.status
      })));

      let discoveredDocumentCount = 0;
      for (const source of this.config.sourceDefinitions) {
        const sourceStartedEvent: RuntimeScanProgressEvent = {
          type: "source.scan.started",
          sourceId: source.id
        };
        emitProgress(options, sourceStartedEvent);
        await this.logInfo(sourceStartedEvent.type, {
          sourceId: sourceStartedEvent.sourceId
        });
        const scan = await this.sourceProvider.scan(source);
        discoveredDocumentCount += scan.candidates.length;
        const sourceFinishedEvent: RuntimeScanProgressEvent = {
          type: "source.scan.finished",
          sourceId: source.id,
          candidateCount: scan.candidates.length
        };
        emitProgress(options, sourceFinishedEvent);
        await this.logInfo(sourceFinishedEvent.type, {
          sourceId: sourceFinishedEvent.sourceId,
          candidateCount: sourceFinishedEvent.candidateCount
        });
        const reconciler = new SourceScanReconciler({
          storage: this.storage
        });

        for (const candidate of scan.candidates) {
          await this.queue.enqueue(this.queue.createJob({
            type: "upsert-document",
            target: {
              documentId: createDocumentId(candidate.sourceId, candidate.relativePath ?? candidate.uri),
              sourceId: candidate.sourceId,
              uri: candidate.uri,
              ...(candidate.relativePath === undefined ? {} : { relativePath: candidate.relativePath }),
              fileType: candidate.fileType,
              updatedAt: candidate.updatedAt,
              size: candidate.size
            }
          }));
        }

        for (const job of await reconciler.reconcile(scan)) {
          await this.queue.enqueue(job);
        }
      }

      await this.queue.drain();
      const finishedEvent: RuntimeScanProgressEvent = {
        type: "scan.finished",
        sourceCount: this.config.sourceDefinitions.length,
        discoveredDocumentCount
      };
      emitProgress(options, finishedEvent);
      await this.logInfo(finishedEvent.type, {
        sourceCount: finishedEvent.sourceCount,
        discoveredDocumentCount: finishedEvent.discoveredDocumentCount
      });
    } catch (error) {
      await this.logError("scan.failed", {
        error: errorMessage(error)
      });
      throw error;
    }
  }

  async inspectSources(): Promise<{
    readonly sources: readonly RuntimeSourceInspection[];
  }> {
    const inspections = await Promise.all(this.config.sourceDefinitions.map(async (source) => {
      const inspection = await this.sourceInspector.inspect(source);
      return {
        sourceId: source.id,
        name: source.name,
        rootUri: source.rootUri,
        includedDocumentCount: inspection.includedCandidates.length,
        skipped: inspection.skipped,
        topLevelPathCounts: inspection.topLevelPathCounts,
        sampleIncludedPaths: inspection.sampleIncludedPaths,
        sampleExcludedPaths: inspection.sampleExcludedPaths
      };
    }));

    return {
      sources: inspections
    };
  }

  async query(input: string): Promise<readonly QueryResult[]> {
    try {
      return await this.queryService.search({
        query: input
      });
    } catch (error) {
      await this.logError("query.failed", {
        error: errorMessage(error)
      });
      throw error;
    }
  }

  getMcpToolHandlers(): McpToolHandlers {
    return this.mcpHandlers;
  }

  async stop(): Promise<void> {
    await this.stopWatching();

    if (this.ownsStorage) {
      this.storage.close();
    }

    await this.logInfo("runtime.stopped");
  }

  private async handleIndexJob(job: IndexJob): Promise<void> {
    if (job.type === "delete-document") {
      await this.deleteExecutor.deleteJob(job);
      return;
    }

    await this.upsertIndexer.upsert({
      sourceId: job.target.sourceId,
      uri: job.target.uri,
      ...(job.target.relativePath === undefined ? {} : { relativePath: job.target.relativePath }),
      fileType: job.target.fileType,
      updatedAt: job.target.updatedAt,
      size: job.target.size ?? 0
    });
  }

  private async logInfo(event: string, metadata = {}): Promise<void> {
    try {
      await this.logger.info(event, metadata);
    } catch {
      // Logging should not make runtime operations fail.
    }
  }

  private async logError(event: string, metadata = {}): Promise<void> {
    try {
      await this.logger.error(event, metadata);
    } catch {
      // Logging should not make runtime operations fail.
    }
  }

  private createMcpStatus() {
    const enabled = this.config.mcp.enabled;
    return {
      enabled,
      access: enabled ? "available" as const : "disabled" as const,
      transport: "stdio" as const,
      startStopSupported: false as const,
      ...(enabled && this.configPath !== undefined ? {
        setupCommand: `mindweave mcp --config ${this.configPath}`
      } : {})
    };
  }
}

function createSQLiteOptions(provider: EmbeddingProvider): SQLiteStorageOptions {
  const dimensions = provider.getConfig().dimensions;
  return dimensions === undefined ? {} : { vectorDimensions: dimensions };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createProviderReadiness(embedding: EffectiveConfig["embedding"]) {
  if (embedding.apiKey !== undefined && embedding.apiKey.length > 0) {
    return {
      ready: true,
      apiKeyPresent: true,
      apiKeySource: "config" as const
    };
  }

  const apiKey = embedding.apiKeyEnv === undefined
    ? undefined
    : process.env[embedding.apiKeyEnv];
  const apiKeyPresent = apiKey !== undefined && apiKey.length > 0;

  return {
    ready: apiKeyPresent,
    ...(embedding.apiKeyEnv === undefined ? {} : { apiKeyEnv: embedding.apiKeyEnv }),
    apiKeyPresent,
    apiKeySource: apiKeyPresent ? "env" as const : "missing" as const
  };
}

function emitProgress(
  options: RuntimeScanOptions,
  event: RuntimeScanProgressEvent
): void {
  options.onProgress?.(event);
}

function createUnsupportedSourceInspector(): SourceInspector {
  return {
    async inspect() {
      throw new Error("Configured source provider does not support inspection.");
    }
  };
}

function isSourceInspector(value: SourceProvider): value is SourceProvider & SourceInspector {
  return "inspect" in value && typeof value.inspect === "function";
}
