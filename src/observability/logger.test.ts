import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefaultLogFilePath,
  FileLogger
} from "./logger.js";

describe("FileLogger", () => {
  it("creates the log directory and appends JSONL events", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mind-weave-logs-"));
    const logPath = path.join(root, "nested", "mindweave.log");
    const logger = new FileLogger(logPath);

    await logger.info("scan.started", { sourceCount: 1 });
    await logger.error("scan.failed", { error: "provider failed" });

    const lines = (await readFile(logPath, "utf8")).trim().split("\n");

    expect(lines.map((line) => JSON.parse(line))).toMatchObject([
      {
        level: "info",
        event: "scan.started",
        sourceCount: 1
      },
      {
        level: "error",
        event: "scan.failed",
        error: "provider failed"
      }
    ]);
    expect(lines.map((line) => JSON.parse(line).timestamp)).toEqual([
      expect.any(String),
      expect.any(String)
    ]);
    expect(logger.logPath).toBe(logPath);
  });
});

describe("createDefaultLogFilePath", () => {
  it("places logs next to the configured SQLite database", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mind-weave-log-path-"));
    const storageDirectory = path.join(root, "state");
    await mkdir(storageDirectory);

    expect(createDefaultLogFilePath(path.join(storageDirectory, "mindweave.sqlite"))).toBe(
      path.join(storageDirectory, "logs", "mindweave.log")
    );
  });
});
