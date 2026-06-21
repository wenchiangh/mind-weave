# Delete Reconciliation and Soft Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Implement delete reconciliation from source scan snapshots and execute soft delete for documents and their derived rows.

**Architecture:** Delete reconciliation belongs to `src/indexing`. It compares source scan results with the stored document registry and emits `delete-document` jobs. Soft delete writes remain storage-owned and query-safe through storage joins. The CLI/runtime wiring remains out of scope for this work unit.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, existing `SourceScanResult`, `IndexJob`, `InMemoryIndexJobQueue`, and `SQLiteStorage`.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#8-indexing-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#11-storage-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not implement filesystem watchers.
- Do not wire CLI `scan` or runtime startup scan.
- Do not implement QueryService.
- Do not physically delete rows.
- Do not implement periodic maintenance cleanup.

## Behavior

WU-12 should add two small indexing-owned capabilities:

- Scan reconciliation:
  - Accept a `SourceScanResult`.
  - Read active documents for that source from storage.
  - Compute document IDs for current candidates using the same `sourceId + relativePath` rule as upsert.
  - Return `delete-document` jobs for active stored documents missing from the current scan snapshot.
  - Include enough target metadata for the queue and delete executor to process the job.

- Delete execution:
  - Accept a `delete-document` job or delete target.
  - Mark the document as `deleted`.
  - Mark its chunks deleted using storage-owned metadata.
  - Preserve traceable document/chunk/embedding/vector rows for now.
  - Ensure normal vector search cannot return deleted rows.

## Storage Adjustment

The public `StoredChunk` contract does not need a deletion field yet.

`SQLiteStorage` should keep chunk soft-delete state internally, for example with a nullable `deleted_at` column. Public reads used by indexing should not return deleted chunks for active processing. Query SQL should exclude deleted chunks as well as deleted documents.

This keeps the deletion model aligned with the detailed design without exposing a chunk lifecycle API before QueryService needs it.

## Testing Strategy

Use `SQLiteStorage`, `InMemoryIndexJobQueue`, `DocumentUpsertIndexer`, `MarkdownProcessor`, and `FakeEmbeddingProvider` where useful.

Cover:

- reconciliation emits delete jobs for documents missing from the latest scan snapshot.
- reconciliation emits no delete jobs for documents still present in the snapshot.
- delete execution marks documents deleted and excludes them from active listings.
- vector search no longer returns a deleted document's chunks.
- queue behavior already covers delete overriding pending upsert and later upsert replacing pending delete; WU-12 should add an integration-level test using the delete executor if needed.

## Implementation Tasks

### Task 1: [x] Extend Storage Soft Delete Semantics

- Add storage-owned chunk soft-delete state.
- Update document delete to mark document and chunks deleted.
- Update chunk replacement to reactivate/upsert current chunks.
- Update vector search SQL to exclude deleted chunks.
- Add storage tests for deleted chunk/vector exclusion.

### Task 2: [x] Implement Scan Reconciliation

- Add an indexing-owned reconciliation service or function.
- Compare scan candidates against active documents.
- Emit queue-ready `delete-document` jobs.
- Keep job ID creation injectable or deterministic enough for tests.

### Task 3: [x] Implement Delete Executor

- Add an indexing-owned delete executor.
- Accept a delete target/job and call storage domain operations.
- Keep delete execution independent from source provider implementations and runtime adapters.

### Task 4: [x] Integration Tests and Boundary Update

- Prove startup-style scan reconciliation can reconstruct delete work from storage state.
- Prove the queue can execute generated delete jobs through the delete executor.
- Keep indexing boundary tests focused on abstract contracts and no concrete adapters.
- Mark WU-12 passed after validation.

## Success Check

WU-12 is successful only if:

- A source scan snapshot can produce delete jobs for previously indexed but now-missing documents.
- A delete job marks the document and its chunks deleted.
- Deleted rows remain traceable in storage but are excluded from normal vector search.
- Queue coalescing semantics remain intact.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Implemented `SourceScanReconciler` to emit `delete-document` jobs for active documents missing from a source scan snapshot.
- Implemented `DocumentDeleteExecutor` to apply queue delete jobs through storage domain operations.
- Added storage-owned chunk soft-delete state while keeping public chunk contracts unchanged.
- Updated vector search to exclude deleted chunks and deleted documents through SQL joins.
- Added integration coverage for startup-style scan reconciliation, queue execution, and deleted row search exclusion.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Plan Review Checklist

- [x] The plan keeps runtime/CLI watcher wiring out of scope.
- [x] The plan uses the existing document registry as the source of delete truth.
- [x] The plan preserves traceability instead of physical deletion.
- [x] The plan avoids exposing chunk deletion fields through public chunk results.
