# Indexing Document Upsert Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the document upsert pipeline from discovered document candidate to persisted chunks, embedding metadata, and vector rows.

**Architecture:** The upsert flow belongs to `src/indexing`. It coordinates source candidates, file loading, document processors, embedding providers, identity helpers, and storage domain operations. It must not depend on CLI/runtime adapters or source provider implementations.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, existing Local FS source candidate shape, MarkdownProcessor, FakeEmbeddingProvider, SQLiteStorage/sqlite-vec.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#8-indexing-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#10-identity-rules`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#11-storage-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not implement delete reconciliation.
- Do not implement source scanning orchestration.
- Do not implement runtime/CLI scan wiring.
- Do not implement MCP or QueryService.
- Do not implement persistent job queue.
- Do not implement content hash based document fingerprint.

## Behavior

The upsert flow should:

- Accept a document candidate or equivalent index target.
- Compute `documentId` from `sourceId + normalized relativePath`.
- Compute document fingerprint from `mtimeMs + size`.
- Skip unchanged active documents by stored fingerprint.
- Read current document content.
- Process document through a matching `DocumentProcessor`.
- Compute chunks through processor output.
- Preserve embeddings for unchanged chunk occurrences in the same document when provider/model/dimensions match.
- Embed only new or changed chunk occurrences.
- Persist document status, chunks, embedding metadata, and vector rows through storage domain operations.
- Mark a previously indexed document `stale` if update processing fails.
- Mark a never-indexed document `failed` if first indexing fails.

## Storage Adjustment

WU-11 may extend storage contracts to read existing document chunks and embedding metadata.

`replaceDocumentChunks` must preserve vector rows for embedding IDs that are still present after replacement. This is required for unchanged chunk preservation.

## Testing Strategy

Use temporary Markdown files, `MarkdownProcessor`, `FakeEmbeddingProvider`, and `SQLiteStorage`.

Cover:

- first index writes document, chunks, embeddings, and vectors.
- unchanged file metadata skips file reading/embedding.
- partial document change embeds only changed chunk occurrences.
- update failure after previous success marks document `stale`.
- first index failure marks document `failed`.
- replacement preserves vector rows for unchanged embedding IDs.

## Implementation Tasks

### Task 1: [x] Extend Storage Read/Preserve Support

- Add storage-domain read method for chunks with embedding metadata.
- Adjust replacement so preserved embedding/vector rows are not deleted.
- Add storage tests for preservation.

### Task 2: [x] Implement Document Upsert Flow

- Create indexing-owned upsert service.
- Read files from `file://` document URI.
- Build processable documents and choose processor.
- Embed missing chunks and write storage.

### Task 3: [x] Add Integration Tests

- Test first index, unchanged skip, partial change, stale failure, failed first index, and vector preservation.

### Task 4: [x] Boundary and Status Update

- Ensure indexing does not depend on CLI/runtime/source provider implementation.
- Mark WU-11 passed after validation.

## Success Check

WU-11 is successful only if:

- A Markdown file candidate can be indexed into SQLite/sqlite-vec.
- Re-indexing unchanged file metadata skips processing and embedding.
- Changing one section embeds only changed chunk occurrences.
- Existing successful documents become `stale` on update failure.
- New failed documents become `failed`.
- Upsert flow writes through storage domain operations.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Implemented `DocumentUpsertIndexer` as an indexing-owned coordinator.
- Extended storage reads with `listDocumentChunks`.
- Adjusted chunk replacement to preserve vector rows for unchanged embedding IDs while deleting removed rows.
- Updated indexing boundary validation to allow abstract processor, embedding, and storage contracts without depending on concrete implementations.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Plan Review Checklist

- [x] The plan is implementation-oriented but does not include code templates.
- [x] The plan wires existing modules without involving CLI/runtime.
- [x] The plan preserves same-document chunk embeddings.
- [x] The plan leaves delete reconciliation to WU-12.
