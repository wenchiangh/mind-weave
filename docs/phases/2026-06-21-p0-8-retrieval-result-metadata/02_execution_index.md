# P0.8 Retrieval Result Metadata Execution Index

This document tracks the focused runtime contract hardening phase derived from P0.7 evaluation.

## Status Legend

- `planned`: scope and acceptance are documented, implementation has not started
- `in_progress`: implementation has started
- `implemented`: implementation is complete, full validation is not yet complete
- `passed`: implementation and validation are complete
- `blocked`: implementation cannot continue without a decision

## Work Units

## WU-00 Phase Definition

- [x] Status: `passed`
- Scope:
  - Define the retrieval result metadata hardening phase.
  - Keep the phase limited to result contract ergonomics.
- Observable result:
  - `00_spec.md`
  - `01_implementation_plan.md`
  - `02_execution_index.md`

## WU-01 Markdown Heading Metadata

- [x] Status: `passed`
- Scope:
  - Add Markdown-derived `metadata.headingPath` to processed chunks.
  - Maintain heading stack state during Markdown processing.
  - Preserve continuous current-version chunk indexes.
- Observable result:
  - Markdown processor tests show heading metadata for nested headings and heading transitions.
  - Chunks before the first heading omit heading metadata.
  - Chunk indexes remain continuous and ordered.

## WU-02 Storage Vector Search Result Metadata

- [x] Status: `passed`
- Scope:
  - Return `relativePath` and `chunkIndex` from storage vector search results.
  - Preserve existing metadata JSON behavior.
- Observable result:
  - SQLite vector search tests show `relativePath`, `chunkIndex`, and metadata in results.

## WU-03 QueryResult Contract Propagation

- [x] Status: `passed`
- Scope:
  - Add `relativePath` and `chunkIndex` to protocol-neutral query results.
  - Preserve query input and ranking behavior.
- Observable result:
  - Query service tests show the new fields are mapped from storage results.

## WU-04 Adapter Output Verification

- [x] Status: `passed`
- Scope:
  - Verify MCP output exposes the hardened QueryResult fields.
  - Keep `search_knowledge` tool name and input contract unchanged.
- Observable result:
  - MCP tests show serialized results include the new fields and metadata.

## WU-05 Validation And Documentation

- [x] Status: `passed`
- Scope:
  - Run full test and typecheck validation.
  - Update docs only for discovered contract corrections.
- Observable result:
  - `pnpm test` passes.
  - `pnpm typecheck` passes.
  - `git diff --check` passes.
