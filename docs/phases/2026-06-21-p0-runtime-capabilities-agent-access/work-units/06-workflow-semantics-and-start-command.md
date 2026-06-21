# Workflow Semantics and Start Command Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this work unit task-by-task.

**Goal:** Make command workflow semantics explicit and tested for `scan`, `query`, `mcp`, `watch`, and `start`.

**Architecture:** Workflows compose existing runtime behavior. Do not refactor scan/watch into new capability classes in this work unit. CLI remains a thin adapter over runtime and MCP serving.

**Tech Stack:** TypeScript, Vitest, existing CLI adapter, app/runtime, and MCP stdio server module.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#4-capability-and-workflow-principle`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

## Command Semantics

- `scan`: one-shot scan and index convergence.
- `query`: read-oriented semantic retrieval.
- `mcp`: serve MCP over the current index only.
- `watch`: start existing runtime scan/watch behavior without MCP.
- `start`: recommended local agent workflow; start existing runtime scan/watch behavior, then serve MCP.

## Testing Strategy

Required tests:

- `watch --config <path>` calls runtime `start()` and does not serve MCP.
- `start --config <path>` calls runtime `start()` and then serves MCP with runtime handlers.
- `mcp --config <path>` remains serve-only and does not call runtime `start()` or `scan()`.
- usage text includes `watch`.

## Implementation Tasks

### Task 1: Add Failing CLI Workflow Tests

- Add tests with injected fake runtime and fake MCP serve function.
- Verify `watch` and `start` behavior independently.

### Task 2: Extend CLI Parsing

- Parse `watch --config <path>`.
- Update usage text.

### Task 3: Route Workflows

- Route `watch` to runtime `start()`.
- Route `start` to runtime `start()` followed by MCP serving.
- Keep `mcp` serve-only.

### Task 4: Verify

- Run targeted CLI tests.
- Run typecheck and full test suite.

## Success Check

This work unit is successful when:

- workflow command semantics are explicit in tests
- `mcp` remains serve-only
- `watch` is available for index/watch without MCP
- `start` composes scan/watch and MCP serving
- `pnpm typecheck` passes
- `pnpm test` passes

