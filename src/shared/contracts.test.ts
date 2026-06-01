import { describe, expect, it } from "vitest";
import type {
  EntityId,
  MetadataRecord,
  UnixMilliseconds,
  UriString
} from "./contracts.js";

describe("shared contracts", () => {
  it("supports primitive cross-module values without runtime wrappers", () => {
    const id: EntityId = "entity-1";
    const uri: UriString = "file:///notes/a.md";
    const timestamp: UnixMilliseconds = 1_717_171_717_000;
    const metadata: MetadataRecord = {
      source: "fixture",
      nested: {
        enabled: true
      }
    };

    expect({ id, uri, timestamp, metadata }).toEqual({
      id: "entity-1",
      uri: "file:///notes/a.md",
      timestamp: 1_717_171_717_000,
      metadata: {
        source: "fixture",
        nested: {
          enabled: true
        }
      }
    });
  });
});
