import crypto from "node:crypto";
import path from "node:path";
import type { EntityId, RelativePath, UnixMilliseconds } from "./contracts.js";

export type DocumentFingerprint = {
  readonly mtimeMs: UnixMilliseconds;
  readonly size: number;
};

export type ChunkPreservationInput = {
  readonly documentId: EntityId;
  readonly chunkIndex: number;
  readonly chunkContentHash: string;
};

export function createGeneratedSourceId(normalizedAbsoluteRootPath: string): EntityId {
  return prefixedHash("source", normalizeAbsolutePath(normalizedAbsoluteRootPath));
}

export function createDocumentId(
  sourceId: EntityId,
  relativePath: RelativePath
): EntityId {
  return prefixedHash("doc", [
    sourceId,
    normalizeRelativeDocumentPath(relativePath)
  ].join("\0"));
}

export function createDocumentFingerprint(input: {
  readonly mtimeMs: UnixMilliseconds;
  readonly size: number;
}): DocumentFingerprint {
  return {
    mtimeMs: input.mtimeMs,
    size: input.size
  };
}

export function documentFingerprintsEqual(
  left: DocumentFingerprint,
  right: DocumentFingerprint
): boolean {
  return left.mtimeMs === right.mtimeMs && left.size === right.size;
}

export function createChunkContentHash(text: string): string {
  return prefixedHash("hash", normalizeChunkText(text));
}

export function createChunkId(input: {
  readonly documentId: EntityId;
  readonly chunkIndex: number;
  readonly chunkContentHash: string;
}): EntityId {
  return prefixedHash("chunk", [
    input.documentId,
    String(input.chunkIndex),
    input.chunkContentHash
  ].join("\0"));
}

export function isSameChunkOccurrenceForPreservation(
  left: ChunkPreservationInput,
  right: ChunkPreservationInput
): boolean {
  return left.documentId === right.documentId
    && left.chunkIndex === right.chunkIndex
    && left.chunkContentHash === right.chunkContentHash;
}

export function normalizeRelativeDocumentPath(relativePath: RelativePath): RelativePath {
  const withForwardSlashes = relativePath.replaceAll("\\", "/");
  const normalized = path.posix.normalize(withForwardSlashes);
  return normalized === "." ? "" : normalized.replace(/^\.\/+/, "");
}

export function normalizeChunkText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function normalizeAbsolutePath(absolutePath: string): string {
  return path.normalize(absolutePath);
}

function prefixedHash(prefix: string, value: string): string {
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  return `${prefix}_${hash.slice(0, 16)}`;
}
