# MCP Stdio Server Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this work unit task-by-task.

**Goal:** Plan and implement a real MCP stdio server around the existing MindWeave MCP tool handlers.

**Architecture:** MCP stdio is an interface adapter. It must register existing tool definitions, call existing tool handlers, and keep retrieval logic inside QueryService/runtime boundaries. It must not run scan or watch implicitly.

**Tech Stack:** TypeScript, Vitest, `@modelcontextprotocol/sdk` v1, existing app/runtime and MCP tool handler modules.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/00_spec.md`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#5-mcp-stdio-transport`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#6-mcp-tool-contract`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`
- Official v1 TypeScript SDK docs: `https://ts.sdk.modelcontextprotocol.io/`

## Decision Summary

- Use the v1 SDK package `@modelcontextprotocol/sdk`.
- Do not use the v2 split packages yet because the official TypeScript SDK repository describes v2 as pre-alpha while v1 remains the recommended production version.
- Implement stdio first.
- Keep HTTP/Streamable HTTP deferred.
- Keep `mcp` serve-only: no implicit scan or watch.

## Files

Expected files:

- Create: `src/interfaces/mcp/stdio-server.ts`
- Test: `src/interfaces/mcp/stdio-server.test.ts`
- Modify: `src/interfaces/mcp/index.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

The CLI command is intentionally not part of this work unit. It belongs to the next work unit so stdio server behavior can be validated independently first.

## Behavior

The stdio server module should expose a focused server factory or runner that:

- accepts existing `McpToolHandlers`
- registers `search_knowledge`
- registers `list_sources`
- connects to a stdio transport when run
- returns MCP tool results as text content containing JSON
- maps thrown handler errors to MCP tool errors
- writes no non-protocol output to stdout

The server module should not:

- load config
- create runtime
- scan sources
- start watchers
- access SQLite directly
- call QueryService directly

## Testing Strategy

Normal tests should not spawn a real long-running CLI process.

Tests should verify:

- server construction registers the expected tools
- calling `search_knowledge` through an MCP client returns handler output
- calling `list_sources` through an MCP client returns handler output
- handler errors are surfaced as MCP tool errors
- no scan/watch/runtime-start behavior is required to create or use the server

Use in-memory transports or SDK-supported test transports if available. If the SDK does not expose a convenient in-memory transport, implement the smallest local test harness around the server factory and avoid testing SDK internals.

## Implementation Tasks

### Task 1: Install SDK Dependency

- Add `@modelcontextprotocol/sdk` v1 to dependencies.
- Keep existing `zod` v4 dependency.
- Verify typecheck still runs after installation.

### Task 2: Add Failing Server Registration Test

- Test that a server created from fake handlers exposes `search_knowledge` and `list_sources` through the MCP SDK interface.
- Verify the test fails before `stdio-server.ts` exists.

### Task 3: Implement MCP Server Factory

- Create a focused stdio-server module.
- Register existing tools.
- Convert tool outputs to JSON text content.
- Keep tool input validation delegated to existing handlers.

### Task 4: Add Tool Call Tests

- Test `search_knowledge` returns the exact handler result wrapped as JSON text.
- Test `list_sources` returns the exact handler result wrapped as JSON text.
- Test thrown handler errors become tool errors.

### Task 5: Export the Server Module

- Export the new server factory or runner from `src/interfaces/mcp/index.ts`.
- Keep existing MCP handler exports unchanged.

### Task 6: Update Execution Index

- Mark WU-01 as passed when the plan and implementation decisions are complete.
- Mark WU-02 as implementing/testing/passed during implementation.

## Success Check

This work unit is successful when:

- The SDK dependency is installed.
- MCP server tests pass.
- Existing MCP tool handler tests still pass.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- The stdio server adapter has no scan/watch/query/storage implementation logic.

