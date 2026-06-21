# Log File Output Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this work unit task-by-task.

**Goal:** Add minimal runtime file logging so background and MCP usage can be diagnosed without a UI.

**Architecture:** Logging is an observability concern. It should live outside CLI, MCP tools, indexing, query, and storage business logic. Runtime composition may create and pass a logger, but modules should not write directly to stdout.

**Tech Stack:** TypeScript, Vitest, Node.js filesystem APIs.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#7-logging-design`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

## Behavior

Add a small logger that can:

- write structured events to a file
- expose the log file path
- support a no-op or capturing logger in tests
- avoid writing secrets intentionally

Runtime should log:

- scan start
- scan finish
- scan failure
- runtime start
- runtime stop
- query failure

MCP stdout isolation should remain protected by existing MCP/CLI tests. More detailed MCP-specific logging may be added after the stdio lifecycle is finalized.

## Default Log Path

Use a deterministic default based on storage path:

```text
<storage directory>/logs/mindweave.log
```

This keeps logs near the local runtime database for config-file based setups and avoids adding a new config field in this phase.

## Testing Strategy

Required tests:

- file logger creates parent directories and appends JSONL-style events
- runtime scan logs start and finish
- runtime scan failure logs failure before surfacing the error
- runtime query failure logs failure

Tests should use fake or temporary dependencies. Normal tests should not call external providers.

## Implementation Tasks

### Task 1: Add Failing Logger Tests

- Add tests for file logger path exposure and append behavior.
- Verify parent log directory creation.

### Task 2: Implement Logger Module

- Create `src/observability/logger.ts`.
- Add logger contract, no-op logger, file logger, and default path helper.
- Export from `src/observability/index.ts`.

### Task 3: Add Runtime Logging Tests

- Add runtime tests using a capturing logger.
- Cover scan success and failure.
- Cover query failure.

### Task 4: Integrate Logger in Runtime

- Add logger dependency injection.
- Create default file logger from storage path when not injected.
- Log runtime events without changing scan/query behavior.

### Task 5: Verify

- Run targeted observability/runtime tests.
- Run typecheck and full test suite.

## Success Check

This work unit is successful when:

- log file output works in tests
- runtime emits useful scan/query events
- existing CLI/MCP stdout behavior is unchanged
- `pnpm typecheck` passes
- `pnpm test` passes

