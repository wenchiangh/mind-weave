import type { EffectiveConfig } from "../config/index.js";
import { loadEffectiveConfigFile } from "../config/index.js";
import type {
  AppRuntime,
  RuntimeCapability,
  RuntimeHealth,
  RuntimeStatus
} from "./contracts.js";
import { AppError } from "./errors.js";

export function getRuntimeHealth(): RuntimeHealth {
  return {
    name: "mind-weave-core",
    status: "ok"
  };
}

export async function createRuntimeFromConfigFile(
  configPath: string
): Promise<AppRuntime> {
  return createRuntime(await loadEffectiveConfigFile(configPath));
}

export function createRuntime(config: EffectiveConfig): AppRuntime {
  return new ConfiguredAppRuntime(config);
}

class ConfiguredAppRuntime implements AppRuntime {
  constructor(private readonly config: EffectiveConfig) {}

  getHealth(): RuntimeHealth {
    return getRuntimeHealth();
  }

  getStatus(): RuntimeStatus {
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
      embedding: {
        provider: this.config.embedding.provider,
        model: this.config.embedding.model,
        dimensions: this.config.embedding.dimensions
      },
      storage: {
        type: this.config.storage.type
      },
      mcp: {
        enabled: this.config.mcp.enabled
      },
      unavailableCapabilities: ["start", "scan", "query"]
    };
  }

  async start(): Promise<void> {
    throwCapabilityNotAvailable("start");
  }

  async scan(): Promise<void> {
    throwCapabilityNotAvailable("scan");
  }

  async query(_input: string): Promise<void> {
    throwCapabilityNotAvailable("query");
  }

  async stop(): Promise<void> {
    // Later work units will stop watchers, queues, MCP, and storage here.
  }
}

function throwCapabilityNotAvailable(capability: RuntimeCapability): never {
  throw new AppError({
    code: "APP_CAPABILITY_NOT_AVAILABLE",
    capability,
    message: `Runtime capability is not available yet: ${capability}.`
  });
}
