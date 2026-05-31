import { describe, expect, it } from "vitest";
import { runCli } from "./main.js";

describe("runCli", () => {
  it("prints runtime health as JSON", () => {
    const writes: string[] = [];
    const exitCode = runCli(["health"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(0);
    expect(writes).toEqual([
      "{\"name\":\"mind-weave-core\",\"status\":\"ok\"}\n"
    ]);
  });

  it("prints usage for unknown commands", () => {
    const writes: string[] = [];
    const exitCode = runCli(["unknown"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(1);
    expect(writes).toEqual([
      "Usage: mindweave health\n"
    ]);
  });
});
