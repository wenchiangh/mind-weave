import { describe, expect, it } from "vitest";
import { getRuntimeHealth } from "./runtime.js";

describe("getRuntimeHealth", () => {
  it("returns a stable runtime health payload", () => {
    expect(getRuntimeHealth()).toEqual({
      name: "mind-weave-core",
      status: "ok"
    });
  });
});
