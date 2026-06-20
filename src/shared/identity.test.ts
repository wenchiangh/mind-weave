import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createChunkContentHash,
  createChunkId,
  createDocumentFingerprint,
  createDocumentId,
  createGeneratedSourceId,
  documentFingerprintsEqual,
  isSameChunkOccurrenceForPreservation,
  normalizeChunkText,
  normalizeRelativeDocumentPath
} from "./identity.js";

describe("identity helpers", () => {
  it("generates deterministic source IDs from normalized absolute root paths", () => {
    const rootPath = path.join("/tmp", "mind-weave", "notes", "..", "notes");

    expect(createGeneratedSourceId(rootPath)).toBe(
      createGeneratedSourceId(path.normalize(rootPath))
    );
    expect(createGeneratedSourceId(rootPath)).toMatch(/^source_[a-f0-9]{16}$/);
  });

  it("does not transform explicit source IDs", () => {
    const explicitSourceId = "personal-notes";

    expect(explicitSourceId).toBe("personal-notes");
  });

  it("normalizes relative document paths for stable IDs", () => {
    expect(normalizeRelativeDocumentPath("./folder\\note.md")).toBe("folder/note.md");
    expect(normalizeRelativeDocumentPath("folder/../folder/note.md")).toBe("folder/note.md");
  });

  it("creates deterministic document IDs from source ID and normalized relative path", () => {
    const left = createDocumentId("source-a", "./folder\\note.md");
    const right = createDocumentId("source-a", "folder/note.md");

    expect(left).toBe(right);
    expect(left).toMatch(/^doc_[a-f0-9]{16}$/);
    expect(createDocumentId("source-b", "folder/note.md")).not.toBe(left);
  });

  it("changes document ID when relative path changes, treating rename as delete plus add", () => {
    expect(createDocumentId("source-a", "before.md")).not.toBe(
      createDocumentId("source-a", "after.md")
    );
  });

  it("creates and compares document fingerprints from mtime and size only", () => {
    const first = createDocumentFingerprint({
      mtimeMs: 1000,
      size: 42
    });
    const same = createDocumentFingerprint({
      mtimeMs: 1000,
      size: 42
    });
    const changedTime = createDocumentFingerprint({
      mtimeMs: 1001,
      size: 42
    });
    const changedSize = createDocumentFingerprint({
      mtimeMs: 1000,
      size: 43
    });

    expect(first).toEqual({
      mtimeMs: 1000,
      size: 42
    });
    expect(documentFingerprintsEqual(first, same)).toBe(true);
    expect(documentFingerprintsEqual(first, changedTime)).toBe(false);
    expect(documentFingerprintsEqual(first, changedSize)).toBe(false);
  });

  it("normalizes chunk text before content hashing", () => {
    expect(normalizeChunkText("  line one\r\nline two\r  ")).toBe("line one\nline two");
    expect(createChunkContentHash("  hello\r\n")).toBe(
      createChunkContentHash("hello\n")
    );
    expect(createChunkContentHash("hello")).toMatch(/^hash_[a-f0-9]{16}$/);
  });

  it("creates chunk IDs from document ID, chunk index, and chunk content hash", () => {
    const contentHash = createChunkContentHash("same text");
    const chunkId = createChunkId({
      documentId: "doc_a",
      chunkIndex: 0,
      chunkContentHash: contentHash
    });

    expect(chunkId).toMatch(/^chunk_[a-f0-9]{16}$/);
    expect(createChunkId({
      documentId: "doc_a",
      chunkIndex: 1,
      chunkContentHash: contentHash
    })).not.toBe(chunkId);
    expect(createChunkId({
      documentId: "doc_b",
      chunkIndex: 0,
      chunkContentHash: contentHash
    })).not.toBe(chunkId);
  });

  it("makes chunk preservation scope explicit to the same document occurrence", () => {
    const hash = createChunkContentHash("same text");

    expect(isSameChunkOccurrenceForPreservation({
      documentId: "doc_a",
      chunkIndex: 0,
      chunkContentHash: hash
    }, {
      documentId: "doc_a",
      chunkIndex: 0,
      chunkContentHash: hash
    })).toBe(true);

    expect(isSameChunkOccurrenceForPreservation({
      documentId: "doc_a",
      chunkIndex: 0,
      chunkContentHash: hash
    }, {
      documentId: "doc_b",
      chunkIndex: 0,
      chunkContentHash: hash
    })).toBe(false);
  });
});
