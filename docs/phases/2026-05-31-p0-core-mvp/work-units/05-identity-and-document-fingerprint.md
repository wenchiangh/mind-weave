# Identity and Document Fingerprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deterministic identity and fingerprint helpers for sources, documents, chunks, and document change detection.

**Architecture:** Identity helpers belong in shared Core utilities because config, source discovery, processing, indexing, and storage all need consistent rules. WU-05 should not implement source scanning, file content reading, Markdown processing, indexing, storage, or embedding reuse logic.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, Node crypto/path utilities.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#10-identity-rules`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/02-config-loading-and-effective-config.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/04-local-fs-source-discovery.md`

## Current Starting Point

Existing modules already use simple string ID aliases:

- `SourceId`
- `DocumentId`
- `ChunkId`
- shared `EntityId`

WU-02 currently generates source IDs inside config. WU-05 should introduce reusable helper rules without forcing a broad refactor unless it improves consistency with low risk.

WU-04 returns source candidates with normalized relative paths and file metadata.

## Non-Goals

- Do not read full document contents to compute document hashes.
- Do not implement strict document content hash.
- Do not implement Markdown chunking.
- Do not implement embedding preservation.
- Do not implement storage writes.
- Do not implement rename detection.
- Do not change move/rename behavior away from delete plus add.
- Do not introduce branded ID types.
- Do not create a global embedding cache key.

## Identity Rules

Implement the accepted P0 rules:

- `sourceId`: user-provided ID or generated ID from normalized absolute source root.
- `documentId`: hash of source ID plus normalized relative path.
- `documentFingerprint`: `{ mtimeMs, size }`.
- `chunkContentHash`: hash of normalized chunk text.
- `chunkId`: hash of document ID plus chunk index plus chunk content hash.

Important semantics:

- Document ID changes when relative path changes. This treats rename/move as delete plus add.
- Document fingerprint uses filesystem metadata only.
- The edge case where content changes without changing `mtimeMs` or `size` is accepted in P0.
- Chunk content hash is not a global embedding cache key.
- Chunk content hash comparisons are valid only within the same document.
- Identical chunk text in different documents does not imply shared embeddings.

## Normalization Rules

Path normalization:

- Relative document paths should use `/` separators for stable IDs across platforms.
- Leading `./` should not affect IDs.
- Redundant path segments should not affect IDs.
- Generated IDs should be deterministic and prefixed to communicate their kind.

Chunk text normalization:

- Normalize line endings to `\n`.
- Trim leading and trailing whitespace.
- Do not collapse internal whitespace in WU-05.
- Markdown processor may later decide how to construct chunk text, but identity helpers should hash whatever normalized chunk text they receive.

Hashing:

- Use SHA-256.
- Return short, deterministic, prefixed IDs/hashes for readability.
- Prefixes should distinguish concepts, such as `source_`, `doc_`, `chunk_`, `hash_`.

## File Responsibilities

Expected files:

- `src/shared/identity.ts`
  - Own deterministic source ID, document ID, document fingerprint, chunk content hash, and chunk ID helpers.
  - Own path/text normalization helpers needed for identity.
  - Should depend only on Node built-ins and shared contracts.

- `src/shared/identity.test.ts`
  - Own unit tests for all identity rules.

Existing files may change:

- `src/config/effective.ts`
  - May use shared source ID helper instead of local hashing to avoid duplicated source ID rules.

- `src/index.ts`
  - May export identity helpers if useful for current package surface.

## Testing Strategy

Tests should cover:

- generated source IDs are deterministic from normalized absolute root paths.
- explicit source IDs remain caller-owned and are not transformed by identity helpers.
- document IDs are deterministic for same source ID and normalized relative path.
- document IDs change when source ID changes.
- document IDs change when relative path changes, proving rename is delete plus add.
- relative path normalization handles backslashes, leading `./`, and redundant segments.
- document fingerprint uses only `mtimeMs` and `size`.
- same fingerprint returns true for same `mtimeMs` and `size`.
- changed `mtimeMs` or `size` changes fingerprint equality.
- chunk text hash is deterministic after line ending and trim normalization.
- chunk IDs include document ID, chunk index, and chunk content hash.
- identical chunk text in different documents produces different chunk IDs.
- same `chunkContentHash` is only meaningful when document ID is the same; expose or test a helper that makes this comparison scope explicit.

## Implementation Tasks

### Task 1: [x] Create Shared Identity Helpers

**Files:**

- Create: `src/shared/identity.ts`
- Create: `src/shared/identity.test.ts`

Plan:

- Implement SHA-256 helper internally.
- Implement source ID, document ID, document fingerprint, chunk content hash, chunk ID, path normalization, and chunk text normalization helpers.
- Keep helper names explicit and small.

Validation:

- Unit tests cover deterministic source/document/chunk identity.
- `pnpm typecheck` passes.

### Task 2: [x] Implement Fingerprint Comparison Semantics

**Files:**

- Modify: `src/shared/identity.ts`
- Modify: `src/shared/identity.test.ts`

Plan:

- Add `createDocumentFingerprint`.
- Add comparison helper for document fingerprint equality.
- Add helper or explicit test coverage for same-document chunk preservation scope.

Validation:

- Tests prove metadata-only fingerprint behavior.
- Tests prove chunk hash preservation is scoped to the same document.

### Task 3: [x] Reuse Source ID Helper in Config

**Files:**

- Modify: `src/config/effective.ts`
- Modify: `src/config/effective.test.ts` if needed

Plan:

- Replace config-local source ID hashing with shared identity helper.
- Keep generated source ID behavior compatible.
- Do not change explicit source ID preservation.

Validation:

- Existing config tests continue to pass.
- Source ID tests cover the shared helper directly.

### Task 4: [x] Public Exports and Boundary Check

**Files:**

- Modify: `src/index.ts`
- Add or update boundary tests if useful.

Plan:

- Export identity helpers that downstream modules will use.
- Ensure shared identity helper does not import config, app, CLI, source, storage, indexing, processor, embedding, or query modules.

Validation:

- Boundary test or source inspection proves shared identity remains low-level.
- `pnpm typecheck` passes.

### Task 5: [x] Mark WU-05 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/05-identity-and-document-fingerprint.md`

Plan:

- During implementation, move WU-05 status through `implementing` and `testing`.
- After validation passes, mark WU-05 as `[x] Status: passed`.
- Mark all checklist tasks in this plan as complete.
- Commit this work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `git status --short` shows only expected files before commit and is clean except unrelated pre-existing untracked files.

## Success Check

WU-05 is successful only if:

- Core has reusable deterministic identity helpers.
- Source ID, document ID, document fingerprint, chunk content hash, and chunk ID rules match detailed design.
- Document fingerprint does not read or hash full file content.
- Rename/move naturally becomes delete plus add because document ID is path-based.
- Chunk hash comparison scope is explicitly same-document.
- Config uses the shared generated source ID helper.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If identity helpers are missing, resume at Task 1.
- If fingerprint comparison or same-document chunk scope is missing, resume at Task 2.
- If config still has a duplicated generated source ID implementation, resume at Task 3.
- If public exports or boundary checks are missing, resume at Task 4.
- If validation passed but docs are not marked complete, resume at Task 5.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan matches accepted identity rules from detailed design.
- [x] The plan keeps identity independent from indexing, storage, processors, and embeddings.
- [x] The plan avoids full document content hashing.
- [x] The plan explicitly preserves same-document scope for chunk content hash comparison.
- [x] The plan treats rename/move as delete plus add.
