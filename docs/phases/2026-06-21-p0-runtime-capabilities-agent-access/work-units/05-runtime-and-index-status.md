# Runtime and Index Status Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this work unit task-by-task.

**Goal:** Make `status` useful for diagnosing whether MindWeave has indexed knowledge and where runtime artifacts live.

**Architecture:** Status remains read-only. Runtime status may aggregate config-derived state, storage metadata, and observability paths, but it must not trigger scan, watch, MCP, query embedding, or provider calls.

**Tech Stack:** TypeScript, Vitest, existing SQLite storage and runtime status.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#8-status-design`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

## Behavior

Status should include:

- configured sources
- embedding provider, model, and dimensions
- storage type and storage path
- log path
- document counts by status

Status should remain synchronous if possible, but it may become async if storage reads require it. If changing `getStatus()` to async causes broad churn, prefer keeping a synchronous storage read method because SQLite access is currently synchronous under the async interface.

## Testing Strategy

Required tests:

- SQLite storage can count documents by `indexed`, `stale`, `failed`, and `deleted`.
- Runtime status reports zero counts for an empty database.
- Runtime status reports populated counts after documents exist.
- Status does not run scan or query.

## Implementation Tasks

### Task 1: Add Failing Storage Count Test

- Add a SQLite test for document status counts.
- Verify deleted documents are counted as deleted, not excluded.

### Task 2: Add Storage Count Method

- Add a small status-oriented storage interface.
- Implement the method in SQLite storage.

### Task 3: Add Failing Runtime Status Test

- Update runtime status expectations for storage path, log path, and document counts.
- Add a populated-index status test if needed.

### Task 4: Extend Runtime Status

- Extend status contracts.
- Populate status from runtime storage and logger.
- Keep status read-only.

### Task 5: Verify

- Run targeted storage/runtime/CLI status tests.
- Run typecheck and full test suite.

## Success Check

This work unit is successful when:

- status exposes storage path, log path, and document counts
- status remains read-only
- targeted tests pass
- `pnpm typecheck` passes
- `pnpm test` passes

