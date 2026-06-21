import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import type { MetadataRecord } from "../shared/contracts.js";

export type LogLevel = "info" | "error";

export type LogEvent = MetadataRecord & {
  readonly level: LogLevel;
  readonly event: string;
  readonly timestamp: string;
};

export interface Logger {
  readonly logPath?: string | undefined;
  info(event: string, metadata?: MetadataRecord): Promise<void>;
  error(event: string, metadata?: MetadataRecord): Promise<void>;
}

export class NoopLogger implements Logger {
  async info(): Promise<void> {}
  async error(): Promise<void> {}
}

export class FileLogger implements Logger {
  constructor(readonly logPath: string) {}

  async info(event: string, metadata: MetadataRecord = {}): Promise<void> {
    await this.write("info", event, metadata);
  }

  async error(event: string, metadata: MetadataRecord = {}): Promise<void> {
    await this.write("error", event, metadata);
  }

  private async write(
    level: LogLevel,
    event: string,
    metadata: MetadataRecord
  ): Promise<void> {
    await mkdir(path.dirname(this.logPath), { recursive: true });
    const payload: LogEvent = {
      level,
      event,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    await appendFile(this.logPath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}

export function createDefaultLogFilePath(storagePath: string): string {
  return path.join(path.dirname(storagePath), "logs", "mindweave.log");
}
