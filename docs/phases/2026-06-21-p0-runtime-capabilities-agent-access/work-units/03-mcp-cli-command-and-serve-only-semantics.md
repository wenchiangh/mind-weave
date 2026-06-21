# MCP CLI Command and Serve-Only Semantics Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this work unit task-by-task.

**Goal:** Add CLI command routing for MCP stdio serving while preserving serve-only semantics.

**Architecture:** CLI remains a thin adapter. It loads runtime from config, obtains existing MCP handlers from runtime, and starts the MCP stdio server. The command must not run scan or watch implicitly.

**Tech Stack:** TypeScript, Vitest, existing CLI adapter, app/runtime, and MCP stdio server module.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#4-capability-and-workflow-principle`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#5-mcp-stdio-transport`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

## Behavior

The CLI command should accept:

```text
mindweave mcp --config <path>
```

The command should:

- load the runtime through the same config path mechanism as other commands
- obtain MCP tool handlers from the runtime
- start MCP serving
- return the serve promise result

The command must not:

- call `scan()`
- call `start()`
- start watchers
- print non-protocol logs to stdout
- implement MCP tool logic directly

## Testing Strategy

Tests should use dependency injection rather than starting a real stdio server.

Required tests:

- `mcp --config <path>` calls the injected MCP serve function with runtime handlers.
- `mcp --config <path>` does not call runtime `scan()` or `start()`.
- usage text includes `mcp --config <path>`.
- existing `health`, `status`, `scan`, and `query` tests continue passing.

## Implementation Tasks

### Task 1: Add Failing CLI Test

- Add a test with an injected fake runtime and fake MCP serve function.
- Assert the command exits successfully.
- Assert serve receives runtime MCP handlers.
- Assert scan/start are not called.

### Task 2: Add CLI Dependency Injection

- Extend `runCli` with optional injected runtime factory and MCP serve function.
- Keep default behavior unchanged for real CLI usage.

### Task 3: Add `mcp` Command Parsing

- Parse `mcp --config <path>`.
- Update usage text.
- Route command to MCP serving.

### Task 4: Verify Boundaries

- Ensure CLI still does not import lower-level source, storage, processor, embedding, indexing, query, or config modules.
- Keep MCP serving logic in `interfaces/mcp`.

## Success Check

This work unit is successful when:

- `mcp --config <path>` is routed by CLI.
- Tests prove serve-only behavior.
- Targeted CLI tests pass.
- `pnpm typecheck` passes.
- `pnpm test` passes.

