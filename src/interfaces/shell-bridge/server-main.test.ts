import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppRuntime } from "../../app/contracts.js";
import type { ShellBridgeHandler } from "./contracts.js";
import {
  parseShellBridgeServeArgs,
  runShellBridgeServer,
  ShellBridgeServeUsageError
} from "./server-main.js";

describe("shell bridge server entrypoint", () => {
  it("does not use top-level await in the process entrypoint", async () => {
    const source = await readFile(
      join(process.cwd(), "src", "interfaces", "shell-bridge", "server-main.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/await runFromProcess/);
  });

  it("parses config path and loopback server options", () => {
    expect(parseShellBridgeServeArgs([
      "--config",
      "/tmp/mindweave/config.json",
      "--host",
      "127.0.0.1",
      "--port",
      "7348"
    ])).toEqual({
      configPath: "/tmp/mindweave/config.json",
      host: "127.0.0.1",
      port: 7348
    });
  });

  it("uses loopback host and ephemeral port by default", () => {
    expect(parseShellBridgeServeArgs([
      "--config",
      "/tmp/mindweave/config.json"
    ])).toEqual({
      configPath: "/tmp/mindweave/config.json",
      host: "127.0.0.1",
      port: 0
    });
  });

  it("returns a structured usage error when config is missing", () => {
    expect(() => parseShellBridgeServeArgs([])).toThrow(ShellBridgeServeUsageError);
    expect(() => parseShellBridgeServeArgs([])).toThrow("Missing required --config <path>.");
  });

  it("creates runtime, bridge handler, and HTTP server through injectable boundaries", async () => {
    const calls: string[] = [];
    const fakeRuntime = {
      stop: async () => {
        calls.push("runtime.stop");
      }
    } as AppRuntime;
    const fakeBridge = {} as ShellBridgeHandler;
    const fakeHttpServer = new CapturingHttpServer();

    const handle = await runShellBridgeServer([
      "--config",
      "/tmp/mindweave/config.json",
      "--port",
      "7348"
    ], {
      createRuntime: async (configPath) => {
        calls.push(`runtime:${configPath}`);
        return fakeRuntime;
      },
      createBridgeHandler: (runtime) => {
        calls.push(runtime === fakeRuntime ? "bridge:runtime" : "bridge:other");
        return fakeBridge;
      },
      createHttpServer: (options) => {
        calls.push(`http:${options.host}:${options.port}:${options.bridge === fakeBridge}`);
        return fakeHttpServer;
      }
    });

    expect(calls).toEqual([
      "runtime:/tmp/mindweave/config.json",
      "bridge:runtime",
      "http:127.0.0.1:7348:true"
    ]);
    expect(fakeHttpServer.startCalls).toBe(1);
    expect(handle.url("/health")).toBe("http://127.0.0.1:7348/health");

    await handle.stop();
    expect(fakeHttpServer.stopCalls).toBe(1);
    expect(calls.at(-1)).toBe("runtime.stop");
  });
});

class CapturingHttpServer {
  startCalls = 0;
  stopCalls = 0;

  async start(): Promise<void> {
    this.startCalls += 1;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }

  url(pathname: string): string {
    return `http://127.0.0.1:7348${pathname}`;
  }
}
