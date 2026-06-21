import { describe, expect, it } from "vitest";
import { toFileUrl } from "./platform-actions.js";

describe("macOS shell platform actions", () => {
  it("converts local absolute paths to file URLs", () => {
    expect(toFileUrl("/Users/me/Mind Weave/config.json")).toBe(
      "file:///Users/me/Mind%20Weave/config.json"
    );
  });

  it("keeps existing file URLs unchanged", () => {
    expect(toFileUrl("file:///Users/me/Notes")).toBe("file:///Users/me/Notes");
  });
});
