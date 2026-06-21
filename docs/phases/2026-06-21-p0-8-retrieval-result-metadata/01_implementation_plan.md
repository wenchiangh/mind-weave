# P0.8 Retrieval Result Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development before implementation. Use superpowers:executing-plans or subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add source-relative location, current chunk position, and Markdown heading metadata to retrieval results without expanding the MCP tool surface.

**Architecture:** Keep metadata derivation inside processors, persistence inside storage, and protocol-neutral result shaping inside query service. MCP and CLI adapters should only expose the existing query result contract.

**Tech Stack:** TypeScript, Vitest, SQLite/sqlite-vec, existing MindWeave module contracts.

---

## Files To Review

- `docs/phases/2026-06-21-p0-8-retrieval-result-metadata/00_spec.md`
- `src/processors/markdown.ts`
- `src/processors/contracts.ts`
- `src/storage/contracts.ts`
- `src/storage/sqlite.ts`
- `src/query/contracts.ts`
- `src/query/service.ts`
- `src/interfaces/mcp/tools.ts`
- existing tests near those modules

## Implementation Principles

- Do not add new MCP tools.
- Do not add `absolutePath`.
- Do not change vector ranking or score normalization.
- Treat `chunkIndex` as current-version positional metadata only.
- Treat `headingPath` as optional Markdown-derived metadata.
- Do not make metadata part of chunk identity, embedding cache identity, or delete behavior.
- Prefer extending existing tests over adding broad end-to-end tests for every layer.

## Work Units

### WU-01 Markdown Heading Metadata

**Goal:** Ensure Markdown chunks carry structured heading context when available.

**Files:**

- Modify: `src/processors/markdown.ts`
- Test: `src/processors/markdown.test.ts`

**Plan:**

- Add or extend processor tests with Markdown containing nested headings.
- Verify produced chunks keep current continuous `index` values.
- Verify chunks under headings include `metadata.headingPath`.
- Verify heading transitions update `metadata.headingPath` for later chunks.
- Verify chunks outside headings omit `headingPath`.
- Keep heading metadata derived from parse state only.
- Do not add a top-level chunk title field.
- Keep `headingPath` out of chunk identity and content hash behavior.

**Maintenance Logic:**

- Maintain an active heading stack while processing Markdown in reading order.
- On a heading, replace lower/equal-level active headings and keep higher-level ancestors.
- On chunk emission, attach a copy of the active heading stack to metadata when it is non-empty.
- Recompute the heading stack from scratch on every document processing run.
- Accept that edits to earlier headings may change later `headingPath` values.

**Acceptance:**

- Markdown processing tests prove heading paths are generated correctly.
- Tests cover nested headings, heading transitions, chunks before the first heading, and continuous chunk indexes.
- Existing chunk text behavior remains compatible with current tests.

### WU-02 Storage Vector Search Result Metadata

**Goal:** Make storage return the fields needed by `QueryService` without a second lookup.

**Files:**

- Modify: `src/storage/contracts.ts`
- Modify: `src/storage/sqlite.ts`
- Test: `src/storage/sqlite.test.ts`
- Test: `src/storage/contracts.test.ts` if contract-shape tests need updates

**Plan:**

- Extend vector search result contract with `relativePath` and `chunkIndex`.
- Update SQLite vector search SQL to select document `relative_path` and chunk `chunk_index`.
- Preserve existing metadata JSON behavior.
- Keep filtering in SQL exactly as before.
- Do not add new tables or migrations for this phase.

**Acceptance:**

- SQLite vector search tests prove `relativePath`, `chunkIndex`, and metadata are returned.
- Existing storage tests still pass.

### WU-03 QueryResult Contract Propagation

**Goal:** Expose the new metadata through protocol-neutral query results.

**Files:**

- Modify: `src/query/contracts.ts`
- Modify: `src/query/service.ts`
- Test: `src/query/service.test.ts`
- Test: `src/query/contracts.test.ts` if contract-shape tests need updates

**Plan:**

- Add optional `relativePath` to `QueryResult`.
- Add `chunkIndex` to `QueryResult`.
- Map storage vector results into query results.
- Keep `uri`, `sourceId`, `sourceName`, `score`, status fields, and metadata behavior unchanged.

**Acceptance:**

- Query service tests prove the fields are present in returned results.
- Query behavior still works with include/exclude filters and score thresholds.

### WU-04 Adapter Output Verification

**Goal:** Prove existing adapters expose the hardened contract without adapter-specific logic.

**Files:**

- Test: `src/interfaces/mcp/stdio-server.test.ts`
- Test: `src/interfaces/mcp/tools.test.ts` if present or appropriate
- Test: `src/app/runtime-e2e.test.ts` if end-to-end coverage is the clearest path

**Plan:**

- Update fake query results used by MCP tests to include `relativePath`, `chunkIndex`, and Markdown metadata.
- Verify `search_knowledge` output serializes those fields.
- Verify runtime E2E can scan Markdown and query a result containing these fields if the existing test structure supports this cleanly.
- Do not add new MCP tool inputs or outputs beyond the query result object fields.

**Acceptance:**

- MCP output tests prove the fields survive adapter serialization.
- Existing CLI/MCP commands remain compatible.

### WU-05 Documentation And Validation

**Goal:** Keep docs and project tracking aligned with the implemented contract.

**Files:**

- Modify: `docs/phases/2026-06-21-p0-8-retrieval-result-metadata/02_execution_index.md`
- Modify: `docs/phases/2026-06-21-p0-7-agent-usage-workflow/04_contract_review.md` only if implementation discovers a contract correction
- Modify: `docs/phases/2026-06-21-p0-6-dogfooding-hardening/03_local_usage_guide.md` only if user-facing query examples need updated output shape

**Plan:**

- Mark work units as they move from planned to passed.
- Run focused tests after each work unit.
- Run full verification before completion.
- Document any deviation from the spec instead of silently changing semantics.

**Validation Commands:**

- `pnpm test`
- `pnpm typecheck`
- `git diff --check`

**Acceptance:**

- All verification commands pass.
- Execution index reflects the final state.
- No unrelated files are changed.
