# Query Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Implement a protocol-independent QueryService that embeds query text, validates query options, delegates filtering to storage SQL, and returns chunk results with traceability metadata.

**Architecture:** QueryService belongs to `src/query`. It depends on the embedding provider contract and storage vector search contract. It must not depend on CLI, MCP, runtime adapters, concrete source providers, or concrete storage implementations.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, existing `EmbeddingProvider`, `VectorSearchStore`, `SQLiteStorage`, and `FakeEmbeddingProvider`.

---

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#13-query-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Non-Goals

- Do not implement MCP tools.
- Do not implement CLI query wiring.
- Do not add reranking, hybrid search, query expansion, generated summaries, or relevance explanations.
- Do not filter vector search results in QueryService after storage returns them.

## Behavior

QueryService should:

- Accept `QueryInput`.
- Trim and validate query text.
- Apply default `limit = 8`.
- Reject `limit < 1` and `limit > 50`.
- Pass include source IDs, exclude source IDs, file types, score threshold, and normalized limit directly to storage.
- Embed query text through the configured embedding provider.
- Return storage-ranked chunk results as protocol-neutral `QueryResult` records.

Storage vector search should:

- Continue applying source, file type, status, score threshold, deleted, failed, and disabled-source filters in SQL.
- Return enough fields for QueryService to build `QueryResult` without a second lookup:
  - chunk ID
  - document ID
  - source ID
  - source name
  - URI
  - chunk text
  - normalized score
  - document status
  - source status
  - source updated time
  - indexed time
  - chunk metadata when present

## Testing Strategy

Cover:

- QueryService default limit and max limit validation.
- QueryService passes all filters to storage unchanged.
- QueryService embeds query text through the provider.
- QueryService maps storage-ranked results without application-side filtering.
- Provider errors propagate to the caller.
- SQLiteStorage returns traceability metadata with vector search rows.
- Integration test proves QueryService can search an indexed fixture database and receive full chunk/source/document metadata.

## Implementation Tasks

### Task 1: [x] Extend Vector Search Result Shape

- Extend storage vector search result contract with traceability fields.
- Update SQLite vector search SQL to select those fields.
- Update storage contract tests and existing SQLite tests.

### Task 2: [x] Implement QueryService

- Add a query-owned concrete service behind the existing `QueryService` contract.
- Validate query text and limit.
- Embed query text using `EmbeddingProvider.embedQuery`.
- Call `VectorSearchStore.searchVectors` with SQL-filter options.
- Map storage results to `QueryResult`.

### Task 3: [x] Add Query Tests

- Unit-test validation and option forwarding with fake providers/stores.
- Integration-test QueryService with SQLiteStorage and deterministic vectors.
- Cover provider error propagation.

### Task 4: [x] Boundary, Exports, and Status Update

- Export QueryService implementation from query and root index.
- Add or update query boundary tests to prevent adapter/concrete implementation dependencies.
- Mark WU-13 passed after validation.

## Success Check

WU-13 is successful only if:

- QueryService returns ordered chunk results with full traceability metadata.
- QueryService does not perform result filtering in application code.
- Storage SQL remains responsible for source, file type, status, score threshold, deleted, failed, and disabled-source filtering.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Completion Notes

- Implemented `CoreQueryService` as a protocol-independent query coordinator.
- Extended `VectorSearchResult` and SQLite vector search SQL to return full chunk, document, and source traceability fields.
- QueryService validates query text and limit, embeds the query, and forwards filter options to storage without post-filtering results.
- Added query boundary, unit, and SQLite integration coverage.
- Validation passed with `pnpm typecheck` and `pnpm test`.

## Plan Review Checklist

- [x] The plan keeps MCP and CLI out of scope.
- [x] The plan uses storage SQL for filtering.
- [x] The plan does not add intelligent answer generation or relevance explanation.
- [x] The plan keeps QueryService protocol-independent.
