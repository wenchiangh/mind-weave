import type {
  RuntimeStatusPayload,
  RuntimeStatusResult,
  ShellBridgeHealthResult
} from "./bridge-client.js";

export type ShellPanelModel = {
  readonly title: string;
  readonly runtime: StatusRow;
  readonly provider: StatusRow;
  readonly index: StatusRow;
  readonly storage: DetailRow;
  readonly watch: StatusRow;
  readonly mcp: StatusRow;
  readonly config: DetailRow;
  readonly logs: DetailRow;
  readonly sources: DetailRow;
};

export type StatusRow = {
  readonly label: string;
  readonly status: string;
  readonly detail: string;
};

export type DetailRow = {
  readonly label: string;
  readonly detail: string;
  readonly primaryPath?: string | undefined;
};

export type WatchControlState = {
  readonly canStart: boolean;
  readonly canStop: boolean;
};

export type CreateShellPanelModelInput = {
  readonly health: ShellBridgeHealthResult;
  readonly runtimeStatus: RuntimeStatusResult;
};

export function createShellPanelModel(
  input: CreateShellPanelModelInput
): ShellPanelModel {
  if (input.runtimeStatus.status === "unavailable") {
    return {
      title: "MindWeave",
      runtime: {
        label: "Runtime",
        status: input.health.status,
        detail: input.runtimeStatus.message
      },
      provider: unavailableStatus("Provider"),
      index: {
        label: "Index",
        status: "unknown",
        detail: "Status unavailable"
      },
      storage: unavailableDetail("Storage"),
      watch: unavailableStatus("Watch"),
      mcp: unavailableStatus("MCP"),
      config: unavailableDetail("Config"),
      logs: unavailableDetail("Logs"),
      sources: unavailableDetail("Sources")
    };
  }

  const status = input.runtimeStatus.response.result;

  return {
    title: "MindWeave",
    runtime: {
      label: "Runtime",
      status: input.health.status,
      detail: input.health.status === "available" ? "Core available" : input.health.message
    },
    provider: createProviderRow(status),
    index: createIndexRow(status),
    storage: {
      label: "Storage",
      detail: status.storage?.path ?? "Storage unavailable"
    },
    watch: createWatchRow(status),
    mcp: createMcpRow(status),
    config: {
      label: "Config",
      detail: status.config?.path ?? "Config path unavailable",
      primaryPath: status.config?.path
    },
    logs: {
      label: "Logs",
      detail: status.observability?.logPath ?? "Log path unavailable",
      primaryPath: status.observability?.logPath
    },
    sources: {
      label: "Sources",
      detail: createSourceSummary(status),
      primaryPath: status.sources?.[0]?.rootUri
    }
  };
}

function createMcpRow(status: RuntimeStatusPayload): StatusRow {
  const mcp = status.mcp;
  if (mcp === undefined) {
    return unavailableStatus("MCP");
  }

  return {
    label: "MCP",
    status: mcp.access,
    detail: `${mcp.transport} / ${mcp.setupCommand ?? "Setup command unavailable"}`
  };
}

function createWatchRow(status: RuntimeStatusPayload): StatusRow {
  const watch = status.watch;
  if (watch === undefined) {
    return unavailableStatus("Watch");
  }

  const noun = watch.watcherCount === 1 ? "watcher" : "watchers";
  return {
    label: "Watch",
    status: watch.status,
    detail: watch.lastError ?? `${watch.watcherCount} ${noun}`
  };
}

export function createWatchControlState(status: string): WatchControlState {
  if (status === "running" || status === "starting") {
    return {
      canStart: false,
      canStop: true
    };
  }

  return {
    canStart: true,
    canStop: false
  };
}

function createProviderRow(status: RuntimeStatusPayload): StatusRow {
  const embedding = status.embedding;
  if (embedding === undefined) {
    return unavailableStatus("Provider");
  }

  return {
    label: "Provider",
    status: embedding.readiness?.ready === false ? "not-ready" : "ready",
    detail: `${embedding.provider} / ${embedding.model}`
  };
}

function createIndexRow(status: RuntimeStatusPayload): StatusRow {
  const index = status.index;
  if (index === undefined) {
    return {
      label: "Index",
      status: "unknown",
      detail: "Index unavailable"
    };
  }

  const documents = index.documents;
  return {
    label: "Index",
    status: documents.failed > 0 ? "needs-attention" : "indexed",
    detail: `${documents.indexed} indexed, ${documents.stale} stale, ${documents.failed} failed, ${index.chunks} chunks, ${index.embeddings} embeddings`
  };
}

function createSourceSummary(status: RuntimeStatusPayload): string {
  const sourceIndex = status.index?.sources[0];
  if (sourceIndex === undefined) {
    return `${status.sourceCount ?? 0} sources`;
  }

  const source = status.sources?.find((candidate) => candidate.id === sourceIndex.sourceId);
  const sourceName = source?.name ?? sourceIndex.sourceId;
  const documents = sourceIndex.documents;

  return `${sourceName}: ${documents.indexed} indexed, ${documents.stale} stale, ${documents.failed} failed`;
}

function unavailableStatus(label: string): StatusRow {
  return {
    label,
    status: "unknown",
    detail: "Status unavailable"
  };
}

function unavailableDetail(label: string): DetailRow {
  return {
    label,
    detail: "Status unavailable"
  };
}
