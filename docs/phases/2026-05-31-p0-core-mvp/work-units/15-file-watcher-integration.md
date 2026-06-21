# File Watcher Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Add local filesystem watcher integration that normalizes Markdown file changes into indexing jobs and routes them through the existing in-memory queue.

**Architecture:** Local filesystem watching belongs to the source adapter layer. Event-to-job mapping belongs to indexing. The queue remains responsible for debounce, coalescing, and retry behavior. Runtime lifecycle wiring remains minimal in this work unit and full end-to-end runtime validation stays in WU-16.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, Node.js filesystem watcher primitives, existing `LocalFsSourceProvider`, `InMemoryIndexJobQueue`, `DocumentUpsertIndexer`, and `DocumentDeleteExecutor`.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#7-source-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#8-indexing-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not implement complete runtime `start` lifecycle.
- Do not implement MCP server startup.
- Do not add a UI or human query loop.
- Do not guarantee realtime indexing latency.
- Do not implement full `.gitignore` compatibility.
- Do not follow symlinks.

## Behavior

WU-15 should add two capabilities:

- Local filesystem event normalization:
  - Watch a local source root.
  - Convert create/change events for supported Markdown files into upsert-capable source candidates.
  - Convert delete events for supported Markdown files into delete-capable document targets.
  - Ignore hidden files/directories, `.git`, `node_modules`, `dist`, `build`, `.DS_Store`, unsupported extensions, symlinks, and configured exclude regex patterns.
  - Use current file stat for upsert events.
  - Use path-derived document identity for delete events when the file no longer exists.

- Index queue routing:
  - Convert normalized source file events into `upsert-document` and `delete-document` jobs.
  - Use the existing `InMemoryIndexJobQueue` for debounce and coalescing.
  - Allow controlled watcher fakes in tests.

## Implementation Direction

Prefer a small adapter seam over a hard dependency on a watcher library:

- Define a local watcher interface owned by `src/sources`.
- Implement a Node-based local filesystem watcher behind that interface.
- Keep event normalization logic testable without relying on real filesystem event timing.
- Use fake watcher/event emitters for deterministic tests.

Node `fs.watch` may be used for the concrete watcher in P0. It is acceptable that deep platform hardening remains for later because startup scan reconciliation remains the consistency backstop.

## Testing Strategy

Cover:

- Markdown create/change event becomes an upsert job with source ID, relative path, URI, file type, updated time, size, and document ID.
- Markdown delete event becomes a delete job with path-derived document ID.
- Unsupported files, hidden paths, ignored directories, symlinks, and exclude regex matches are ignored.
- Event routing uses the queue, so same-document event coalescing remains queue-owned.
- Watcher errors are exposed through a callback or observable status path.

Use controlled fake watcher/event sources for most tests. A real filesystem watcher smoke test is optional only if it is stable in the current environment.

## Implementation Tasks

### Task 1: [x] Add Source File Event Contracts

- Define source file event types for upsert and delete.
- Define a source watcher interface with `start`/`stop` or callback-driven semantics.
- Keep contracts independent from indexing queue internals.

### Task 2: [x] Implement Local FS Event Normalization

- Add testable helpers for local path to source event conversion.
- Reuse LocalFsSourceProvider filtering rules where practical.
- Use path-derived delete targets when files are gone.

### Task 3: [x] Implement Event-to-Queue Routing

- Add indexing-owned event router that converts source file events into queue jobs.
- Keep job creation deterministic or injectable for tests.
- Do not process file content in the router.

### Task 4: [x] Add Tests and Boundary Coverage

- Add source normalization tests.
- Add indexing router tests with fake queue.
- Add boundary tests proving source watcher code does not import storage, processors, embeddings, query, MCP, or app.
- Mark WU-15 passed after validation.

## Success Check

WU-15 is successful only if:

- Local Markdown file create/change/delete events can be normalized into indexing jobs.
- Queue debounce/coalescing remains the only coalescing mechanism.
- Ignored paths and unsupported files do not enqueue work.
- Watcher errors are observable by the caller.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Added source file event and watcher contracts.
- Implemented local filesystem watch event normalization for Markdown upsert/delete events.
- Implemented `LocalFsSourceWatcher` with an injectable watcher seam for deterministic tests.
- Implemented `SourceEventIndexJobRouter` to convert source file events into queue jobs.
- Kept full runtime lifecycle wiring for WU-16 end-to-end validation.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Plan Review Checklist

- [x] The plan keeps full runtime startup out of scope.
- [x] The plan keeps startup scan as the consistency backstop.
- [x] The plan separates source event normalization from indexing job routing.
- [x] The plan avoids adding a watcher library before there is a clear need.
