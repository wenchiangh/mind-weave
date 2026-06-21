# SQLite Metadata Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SQLite-backed metadata storage for sources, documents, chunks, embeddings metadata, schema marker, and index config.

**Architecture:** Storage belongs to `src/storage`. It exposes domain operations through storage contracts and hides SQL details from indexing, query, CLI, and runtime adapters. WU-07 does not implement sqlite-vec or vector search.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, SQLite via `better-sqlite3` if installable in the current Node environment.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#11-storage-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/05-identity-and-document-fingerprint.md`

## Current Starting Point

WU-01 created storage capability contracts:

- `SourceStatusStore`
- `DocumentRegistryStore`
- `ChunkEmbeddingStore`
- `VectorSearchStore`
- `IndexConfigStore`

WU-07 should implement the metadata capabilities. `VectorSearchStore` remains unimplemented until WU-08.

## Non-Goals

- Do not implement sqlite-vec.
- Do not create `vec_embeddings`.
- Do not implement vector insert or KNN search.
- Do not implement QueryService.
- Do not implement indexing queue behavior.
- Do not call embedding providers.
- Do not implement maintenance cleanup.
- Do not implement schema migrations.
- Do not implement reset-index CLI command.
- Do not open storage from CLI/runtime in this work unit.

## Dependency Decision

Use `better-sqlite3` as directed by detailed design if it installs and typechecks in the current environment.

If native package installation fails because of Node 24 or local build constraints:

- Do not fake storage with an in-memory map.
- Record the blocker clearly.
- Keep the plan and execution index in a blocked state.

## Schema Scope

WU-07 should create normal SQLite tables only:

- `meta`
- `index_config`
- `sources`
- `documents`
- `chunks`
- `embeddings`

Do not create sqlite-vec virtual tables in WU-07.

Schema marker:

- Store a single schema version in `meta`.
- If no schema marker exists, initialize schema.
- If an incompatible schema marker exists, fail with a structured storage error.
- Do not implement migrations.

Source mirror:

- Sources are a rebuildable mirror of effective config.
- `saveSources` replaces the current source mirror with the provided effective sources.

Document registry:

- Documents are persistent and support delete reconciliation.
- `listActiveDocuments(sourceId)` returns non-deleted documents for that source.
- `markDocumentDeleted(documentId, deletedAt)` marks the document deleted.

Chunks and embeddings:

- Chunks belong to documents.
- Embeddings belong to chunk occurrences.
- WU-07 stores embedding metadata only, not vectors.
- `replaceDocumentChunks` should transactionally replace chunks and embedding metadata for one document.
- Different chunk occurrences must not share one embedding record.

Index config:

- `readIndexConfig` reads stored config metadata.
- `writeIndexConfig` replaces stored config metadata.
- Compatibility enforcement belongs to later runtime/indexing work; WU-07 only persists the record.

## Error Semantics

Create storage-owned structured errors.

Recommended error codes:

- `STORAGE_SCHEMA_INCOMPATIBLE`
- `STORAGE_OPEN_FAILED`
- `STORAGE_OPERATION_FAILED`

Errors should include:

- machine-readable code
- human-readable message
- database path when relevant

## File Responsibilities

Expected files:

- `src/storage/errors.ts`
  - Own structured storage errors.

- `src/storage/sqlite.ts`
  - Own `SQLiteStorage`.
  - Own schema initialization, schema marker check, SQL statements, transactions, and domain operations.
  - Should implement `SourceStatusStore`, `DocumentRegistryStore`, `ChunkEmbeddingStore`, and `IndexConfigStore`.
  - Should not implement `VectorSearchStore` yet.

- `src/storage/index.ts`
  - Re-export storage contracts and SQLite metadata storage APIs intended for current use.

- `src/storage/sqlite.test.ts`
  - Temporary database integration tests.

Existing files may change:

- `src/storage/contracts.ts`
  - May add minimal methods/types needed for metadata operations, but avoid expanding into query/vector concerns.

- `src/index.ts`
  - May export storage APIs if useful for current package surface.

## Testing Strategy

Tests should use temporary SQLite database files.

Cover:

- schema creation on first open.
- existing compatible schema opens successfully.
- incompatible schema marker fails clearly.
- source mirror save/list roundtrip.
- source mirror rebuild removes sources not present in new effective source list.
- document upsert and active document listing.
- document soft delete excludes it from active listing.
- chunk and embedding metadata replacement for one document.
- replacement removes old chunks/embeddings for that document.
- index config read/write roundtrip.
- storage module boundary does not import config, app, CLI, source provider implementation, processors, indexing, embeddings, or query modules.

## Implementation Tasks

### Task 1: [x] Add SQLite Dependency

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

Plan:

- Add `better-sqlite3`.
- Add type dependency only if needed by TypeScript.
- Do not add sqlite-vec in WU-07.

Validation:

- `pnpm typecheck` can load SQLite types.
- If install fails, stop and mark WU-07 blocked.

### Task 2: [x] Define Storage Errors and Exports

**Files:**

- Create: `src/storage/errors.ts`
- Create: `src/storage/index.ts`
- Modify: `src/index.ts` if useful

Plan:

- Add storage-owned structured errors.
- Re-export contracts and SQLite storage APIs.

Validation:

- Typecheck passes.

### Task 3: [x] Implement Schema Initialization

**Files:**

- Create: `src/storage/sqlite.ts`
- Create: `src/storage/sqlite.test.ts`

Plan:

- Open/create SQLite database.
- Initialize normal metadata tables.
- Write and verify schema marker.
- Fail on incompatible schema marker.

Validation:

- Temporary database tests cover first open, reopen, and incompatible schema marker.

### Task 4: [x] Implement Source and Document Operations

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Implement `saveSources`, `listSources`, `upsertDocument`, `listActiveDocuments`, and `markDocumentDeleted`.
- Keep source mirror rebuild simple and transactional.

Validation:

- Tests cover source mirror rebuild, document upsert, active listing, and soft delete.

### Task 5: [x] Implement Chunk and Embedding Metadata Replacement

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Implement `replaceDocumentChunks`.
- Delete/replace old chunks and old embedding metadata for the document in one transaction.
- Store embedding metadata only.

Validation:

- Tests cover replacement and old row removal.

### Task 6: [x] Implement Index Config Persistence and Boundary Check

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`
- Add boundary test if useful.

Plan:

- Implement `readIndexConfig` and `writeIndexConfig`.
- Add module boundary validation.

Validation:

- Tests cover null initial config and roundtrip.
- Boundary tests pass.

### Task 7: [x] Mark WU-07 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/07-sqlite-metadata-storage.md`

Plan:

- During implementation, move WU-07 status through `implementing` and `testing`.
- After validation passes, mark WU-07 as `[x] Status: passed`.
- Mark all checklist tasks in this plan as complete.
- Commit this work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- Worktree is clean except unrelated pre-existing untracked files.

## Success Check

WU-07 is successful only if:

- SQLite metadata schema initializes with a schema marker.
- Incompatible schema marker fails clearly.
- Source mirror can be rebuilt.
- Documents can be upserted, listed, and soft-deleted.
- Chunks and embedding metadata can be transactionally replaced for a document.
- Index config can be persisted and read.
- No sqlite-vec/vector search behavior is included.
- Storage exposes domain operations, not raw SQL.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If dependency install is incomplete, resume at Task 1.
- If storage errors/exports are missing, resume at Task 2.
- If schema initialization is missing, resume at Task 3.
- If source/document operations are incomplete, resume at Task 4.
- If chunk/embedding metadata replacement is incomplete, resume at Task 5.
- If index config or boundary checks are missing, resume at Task 6.
- If validation passed but docs are not marked complete, resume at Task 7.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan matches WU-07 scope and excludes sqlite-vec/vector search.
- [x] The plan implements storage through domain operations.
- [x] The plan includes schema marker behavior without migrations.
- [x] The plan covers source mirror, document registry, soft delete, chunk replacement, embedding metadata, and index config.
