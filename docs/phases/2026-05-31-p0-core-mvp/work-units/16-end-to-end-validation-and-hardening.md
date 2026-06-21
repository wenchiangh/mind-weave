# End-to-End Validation and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Validate and harden the P0 Core MVP loop from config to source scan, indexing, query, MCP tool handlers, and file updates.

**Architecture:** WU-16 composes already-built modules in `src/app`. CLI remains a thin adapter. Runtime composition may instantiate concrete P0 implementations, but adapters must still call runtime/core services instead of bypassing them.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/00_spec.md#acceptance-criteria`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#6-runtime-and-lifecycle`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#15-testing-strategy`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not add a Tauri UI.
- Do not add a human query playground.
- Do not implement a long-running MCP transport/server if it requires a new dependency or broad lifecycle work.
- Do not implement persistent queues.
- Do not add non-Markdown sources.

## Behavior

Runtime should:

- Compose P0 implementations from effective config:
  - `SQLiteStorage`
  - `LocalFsSourceProvider`
  - `MarkdownProcessor`
  - `OpenAICompatibleEmbeddingProvider`
  - `DocumentUpsertIndexer`
  - `DocumentDeleteExecutor`
  - `InMemoryIndexJobQueue`
  - `CoreQueryService`
  - MCP tool handlers
- Support dependency injection for tests, especially fake embedding providers.
- `scan()` should:
  - persist effective sources into storage.
  - scan each configured source.
  - enqueue upsert jobs for discovered candidates.
  - reconcile missing active documents into delete jobs.
  - drain the queue.
- `query(text)` should:
  - call QueryService.
  - return query results.
- `start()` should:
  - run startup scan.
  - start local file watchers that route events into the same queue.
- `stop()` should:
  - stop watchers.
  - close owned storage.
- Runtime should expose MCP handlers for tests/future transport registration.

## CLI Behavior

- `scan --config <path>` should run runtime scan and output a structured success payload.
- `query --config <path> <query>` should output `{ results: [...] }`.
- `status --config <path>` should continue to output runtime status.
- CLI must remain a thin adapter and not import lower-level modules directly.

## Testing Strategy

Cover:

- Runtime E2E with temporary config, Markdown file, fake embedding provider, scan, query, and MCP `search_knowledge`.
- File edit followed by scan updates query results.
- File deletion followed by scan removes query results.
- CLI scan/query route through runtime and produce JSON.
- Provider failure is visible through structured CLI/runtime errors.
- Runtime stop closes resources.

## Remaining Gap Recording

If a true MCP transport/server is not implemented in WU-16, record that as a follow-up gap while keeping MCP tool handlers validated and callable.

## Implementation Tasks

### Task 1: [x] Runtime Composition

- Add runtime dependency injection options.
- Compose storage, source provider, processor, embedding provider, queue, indexers, query service, watcher, and MCP handlers.
- Keep ownership/cleanup explicit.

### Task 2: [x] Runtime Scan and Query

- Implement `scan()` as startup-scan reconciliation and indexing.
- Implement `query()` as QueryService call returning results.
- Expose MCP handlers.

### Task 3: [x] CLI Output

- Make `scan` output structured success JSON.
- Make `query` output results JSON.
- Preserve CLI adapter boundary.

### Task 4: [x] End-to-End Tests and Gap Notes

- Add runtime/CLI end-to-end tests.
- Update previous unavailable-capability tests.
- Record any remaining P0 gaps.
- Mark WU-16 passed after validation.

## Success Check

WU-16 is successful only if:

- A temporary Markdown source can be configured, scanned, indexed, queried, and searched through MCP handlers.
- File edits and deletes converge after scan reconciliation.
- CLI scan/query work through runtime.
- Remaining gaps are documented.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Runtime now composes P0 storage, source scanning, Markdown processing, indexing, vector search, QueryService, MCP handlers, and local file watcher routing.
- `scan()` performs startup-style scan, upsert enqueueing, delete reconciliation, and queue drain.
- `query()` returns QueryService results.
- Runtime exposes MCP tool handlers for `search_knowledge` and `list_sources`.
- CLI `scan` and `query` now output structured JSON.
- End-to-end tests cover scan, indexing, query, MCP handler search, file edit update, and file deletion reconciliation using a fake embedding provider.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Remaining Gaps

- A real MCP transport/server process is not started yet; P0 currently validates adapter tool handlers that can be registered by a future transport layer.
- Log file output is not implemented yet; current failures are surfaced through structured errors and tests.
- Real OpenAI-compatible embedding calls require user environment configuration and are covered by provider-level tests, not by the deterministic E2E test.

## Plan Review Checklist

- [x] The plan composes existing modules instead of rewriting them.
- [x] The plan keeps CLI as an adapter.
- [x] The plan uses fake embedding providers for deterministic tests.
- [x] The plan documents transport/server gaps instead of hiding them.
