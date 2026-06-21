# MCP Search and Source Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Implement protocol-adapter tool handlers for `search_knowledge` and `list_sources` over QueryService and storage source reads.

**Architecture:** The MCP adapter belongs under `src/interfaces/mcp`. It is an external interface adapter. It may call QueryService and approved storage read contracts, but it must not access SQLite directly, scan files, chunk documents, embed documents, run indexing jobs, or add reasoning/summaries.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, existing `QueryService`, `SourceStatusStore`, and public result/source contracts.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#14-mcp-interface`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not start a real MCP stdio/server process in this work unit.
- Do not add MCP SDK dependency unless implementation proves it necessary.
- Do not wire runtime lifecycle or config.
- Do not implement `get_chunk`, `get_document`, `reindex_source`, `open_file`, or debug tools.
- Do not add summaries, relevance explanations, or model reasoning.

## Behavior

The adapter should expose two tool handlers:

- `search_knowledge`
  - Input:
    - `query`: required string.
    - `limit`: optional number.
    - `includeSourceIds`: optional string array.
    - `excludeSourceIds`: optional string array.
    - `fileTypes`: optional string array.
    - `scoreThreshold`: optional number from `0..1`.
  - Behavior:
    - Validate input shape before calling QueryService.
    - Allow include and exclude source filters together.
    - Pass valid input directly to QueryService.
    - Return `{ results: [...] }`.
    - Return empty `results` for successful no-match queries.
    - Propagate query/runtime failures as tool errors.
  - Output result fields:
    - `chunkId`
    - `documentId`
    - `sourceId`
    - `sourceName`
    - `uri`
    - `text`
    - `score`
    - `documentStatus`
    - `sourceStatus`
    - `sourceUpdatedAt`
    - `indexedAt`
    - `metadata` when present

- `list_sources`
  - Input:
    - No required input.
  - Behavior:
    - Read sources through `SourceStatusStore.listSources`.
    - Return `{ sources: [...] }`.
  - Output source fields:
    - `sourceId`
    - `name`
    - `type`
    - `rootUri`
    - `status`
    - `lastScannedAt` when present
    - `lastError` when present

## Tool Representation

P0 should implement adapter-owned tool definitions and handler functions without requiring an actual MCP transport.

This lets tests and future runtime composition call the same mapping code that a real MCP server will register later.

## Testing Strategy

Cover:

- `search_knowledge` input validation.
- `search_knowledge` output schema and full chunk text.
- include/exclude source filter forwarding.
- empty result behavior.
- query error behavior.
- `list_sources` output schema.
- adapter boundary: no SQLite, source provider, processor, embedding, indexing, config, or app imports.

## Implementation Tasks

### Task 1: [x] Define MCP Tool Adapter Contracts

- Add adapter-owned tool names, input/output types, and a small handler interface.
- Keep these types protocol-neutral enough to be wrapped by a future MCP SDK registration layer.

### Task 2: [x] Implement Tool Handlers

- Implement `search_knowledge` over `QueryService.search`.
- Implement `list_sources` over `SourceStatusStore.listSources`.
- Validate raw input before calling core services.

### Task 3: [x] Add Adapter Tests

- Test search input validation, filter forwarding, empty results, output fields, and error propagation.
- Test list sources output fields.
- Add boundary tests proving the adapter does not bypass core services.

### Task 4: [x] Exports and Status Update

- Export MCP adapter handlers from `src/interfaces/mcp`.
- Do not export them from root unless runtime composition needs it later.
- Mark WU-14 passed after validation.

## Success Check

WU-14 is successful only if:

- `search_knowledge` returns QueryService results without adding summaries or explanations.
- `list_sources` returns source status rows through storage read contracts.
- Adapter tests cover success, empty, validation, and failure paths.
- MCP adapter does not access SQLite directly.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Implemented adapter-owned MCP tool definitions for `search_knowledge` and `list_sources`.
- Implemented `createMcpToolHandlers` over `QueryService` and `SourceStatusStore`.
- Added input validation for `search_knowledge`.
- Added adapter tests for schema, success, empty result, invalid input, error propagation, `list_sources`, and boundary rules.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Plan Review Checklist

- [x] The plan keeps MCP transport/server lifecycle out of scope.
- [x] The plan preserves QueryService as the only query path.
- [x] The plan avoids intelligent post-processing.
- [x] The plan leaves runtime MCP startup for a later work unit.
