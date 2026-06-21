import { fileURLToPath } from "node:url";
import { isAppError } from "../../app/errors.js";
import {
  createRuntimeFromConfigFile,
  getRuntimeHealth
} from "../../app/runtime.js";

export type CliIO = {
  write: (value: string) => void;
};

type CliCommand =
  | { readonly name: "health" }
  | { readonly name: "status" | "start" | "scan"; readonly configPath: string }
  | { readonly name: "query"; readonly configPath: string; readonly query: string };

type CliUsageError = {
  readonly code: "CLI_USAGE_ERROR";
  readonly message: string;
};

export async function runCli(args: string[], io: CliIO): Promise<number> {
  let command: CliCommand;
  try {
    command = parseCommand(args);
  } catch (error) {
    writeJson(io, formatError(error));
    return 1;
  }

  try {
    if (command.name === "health") {
      writeJson(io, getRuntimeHealth());
      return 0;
    }

    const runtime = await createRuntimeFromConfigFile(command.configPath);

    if (command.name === "status") {
      writeJson(io, runtime.getStatus());
      return 0;
    }

    if (command.name === "start") {
      await runtime.start();
      return 0;
    }

    if (command.name === "scan") {
      await runtime.scan();
      writeJson(io, { status: "scanned" });
      return 0;
    }

    if (command.name === "query") {
      writeJson(io, { results: await runtime.query(command.query) });
      return 0;
    }

    throw usageError("Unknown command.");
  } catch (error) {
    writeJson(io, formatError(error));
    return 1;
  }
}

function parseCommand(args: readonly string[]): CliCommand {
  const [command] = args;

  if (command === "health") {
    return {
      name: "health"
    };
  }

  if (command === "status" || command === "start" || command === "scan") {
    return {
      name: command,
      configPath: requireConfigPath(args)
    };
  }

  if (command === "query") {
    const configPath = requireConfigPath(args);
    const query = args.find((arg, index) =>
      index > 0 && arg !== "--config" && args[index - 1] !== "--config"
    );

    if (query === undefined || query.length === 0) {
      throw usageError("Missing query text.");
    }

    return {
      name: "query",
      configPath,
      query
    };
  }

  throw usageError(
    "Usage: mindweave health | status --config <path> | start --config <path> | scan --config <path> | query --config <path> <query>"
  );
}

function requireConfigPath(args: readonly string[]): string {
  const configIndex = args.indexOf("--config");
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;

  if (configPath === undefined || configPath.length === 0 || configPath.startsWith("--")) {
    throw usageError("Missing required --config <path>.");
  }

  return configPath;
}

function usageError(message: string): CliUsageError {
  return {
    code: "CLI_USAGE_ERROR",
    message
  };
}

function writeJson(io: CliIO, value: unknown): void {
  io.write(`${JSON.stringify(value)}\n`);
}

function formatError(error: unknown): unknown {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      capability: error.capability,
      issues: error.issues
    };
  }

  if (isStructuredError(error)) {
    return {
      code: error.code,
      message: error.message,
      path: error.path,
      issues: error.issues
    };
  }

  return {
    code: "CLI_UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown CLI error."
  };
}

function isStructuredError(error: unknown): error is {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly issues?: readonly unknown[];
} {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && "message" in error;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const exitCode = await runCli(process.argv.slice(2), {
    write: (value) => process.stdout.write(value)
  });

  process.exitCode = exitCode;
}
