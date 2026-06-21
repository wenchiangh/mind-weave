export type ShellBridgeHealthResult =
  | {
    readonly status: "available";
    readonly url: string;
    readonly response: unknown;
  }
  | {
    readonly status: "unavailable";
    readonly url: string;
      readonly message: string;
    };

export type RuntimeStatusAvailable = {
  readonly status: "available";
  readonly url: string;
  readonly response: {
    readonly ok: true;
    readonly operation: "status";
    readonly result: RuntimeStatusPayload;
  };
};

export type RuntimeStatusResult =
  | RuntimeStatusAvailable
  | {
    readonly status: "unavailable";
    readonly url: string;
    readonly message: string;
  };

export type ShellBridgeCommandResult =
  | {
    readonly status: "available";
    readonly url: string;
    readonly response: unknown;
  }
  | {
    readonly status: "unavailable";
    readonly url: string;
    readonly message: string;
  };

export type RuntimeStatusPayload = {
  readonly name?: string;
  readonly status?: string;
  readonly sourceCount?: number;
  readonly sources?: readonly RuntimeSourcePayload[];
  readonly config?: RuntimeConfigPayload;
  readonly embedding?: RuntimeEmbeddingPayload;
  readonly storage?: RuntimeStoragePayload;
  readonly observability?: RuntimeObservabilityPayload;
  readonly index?: RuntimeIndexPayload;
  readonly watch?: RuntimeWatchPayload;
  readonly mcp?: RuntimeMcpPayload;
};

export type RuntimeConfigPayload = {
  readonly path?: string;
};

export type RuntimeSourcePayload = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly rootUri: string;
  readonly status: string;
};

export type RuntimeEmbeddingPayload = {
  readonly provider: string;
  readonly model: string;
  readonly readiness?: {
    readonly ready: boolean;
    readonly apiKeyEnv: string;
    readonly apiKeyPresent: boolean;
  };
};

export type RuntimeStoragePayload = {
  readonly type: string;
  readonly path: string;
};

export type RuntimeObservabilityPayload = {
  readonly logPath?: string;
};

export type RuntimeIndexPayload = {
  readonly documents: {
    readonly indexed: number;
    readonly stale: number;
    readonly failed: number;
    readonly deleted: number;
  };
  readonly chunks: number;
  readonly embeddings: number;
  readonly sources: readonly RuntimeSourceIndexPayload[];
};

export type RuntimeSourceIndexPayload = {
  readonly sourceId: string;
  readonly name: string;
  readonly indexed: number;
  readonly stale: number;
  readonly failed: number;
  readonly deleted: number;
};

export type RuntimeWatchPayload = {
  readonly status: string;
  readonly watcherCount: number;
  readonly lastError?: string;
};

export type RuntimeMcpPayload = {
  readonly enabled: boolean;
  readonly access: string;
  readonly transport: string;
  readonly startStopSupported: boolean;
  readonly setupCommand?: string;
};

export type ReadBridgeHealthOptions = {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch | undefined;
};

export async function readBridgeHealth(
  options: ReadBridgeHealthOptions
): Promise<ShellBridgeHealthResult> {
  return readBridgeJson(options, "/health");
}

export async function readRuntimeStatus(
  options: ReadBridgeHealthOptions
): Promise<RuntimeStatusResult> {
  const result = await readBridgeJson(options, "/status");

  if (result.status === "unavailable") {
    return result;
  }

  if (isBridgeError(result.response)) {
    return {
      status: "unavailable",
      url: result.url,
      message: result.response.error.message
    };
  }

  return result as RuntimeStatusAvailable;
}

export async function triggerScan(
  options: ReadBridgeHealthOptions
): Promise<ShellBridgeCommandResult> {
  return postBridgeCommand(options, "/scan");
}

export async function startWatch(
  options: ReadBridgeHealthOptions
): Promise<ShellBridgeCommandResult> {
  return postBridgeCommand(options, "/watch/start");
}

export async function stopWatch(
  options: ReadBridgeHealthOptions
): Promise<ShellBridgeCommandResult> {
  return postBridgeCommand(options, "/watch/stop");
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function readBridgeJson(
  options: ReadBridgeHealthOptions,
  pathname: string
): Promise<ShellBridgeHealthResult> {
  const url = `${trimTrailingSlash(options.baseUrl)}${pathname}`;
  const fetchImpl = options.fetch ?? fetch;

  try {
    const response = await fetchImpl(url);
    return {
      status: "available",
      url,
      response: await response.json()
    };
  } catch (error) {
    return {
      status: "unavailable",
      url,
      message: error instanceof Error ? error.message : "Bridge request failed."
    };
  }
}

async function postBridgeCommand(
  options: ReadBridgeHealthOptions,
  pathname: string
): Promise<ShellBridgeCommandResult> {
  const result = await readBridgeJson({
    ...options,
    fetch: async (url) => (options.fetch ?? fetch)(url, {
      method: "POST"
    })
  }, pathname);

  if (result.status === "unavailable") {
    return result;
  }

  if (isBridgeError(result.response)) {
    return {
      status: "unavailable",
      url: result.url,
      message: result.response.error.message
    };
  }

  return result;
}

function isBridgeError(value: unknown): value is {
  readonly ok: false;
  readonly error: {
    readonly message: string;
  };
} {
  return typeof value === "object"
    && value !== null
    && "ok" in value
    && value.ok === false
    && "error" in value
    && typeof value.error === "object"
    && value.error !== null
    && "message" in value.error
    && typeof value.error.message === "string";
}
