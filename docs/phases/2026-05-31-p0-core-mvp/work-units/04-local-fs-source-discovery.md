# Local FS Source Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local filesystem source scanning for Markdown documents behind the `SourceProvider` contract.

**Architecture:** Source discovery belongs to `src/sources`. It discovers candidate documents and returns metadata only. It must not read file contents, chunk documents, embed text, write storage, enqueue indexing jobs, or depend on CLI/runtime adapters.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, Node filesystem APIs.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow an implementation agent to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/02_architecture.md`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#7-source-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/02-config-loading-and-effective-config.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/03-runtime-composition-and-cli-shell.md`

## Current Starting Point

WU-02 produces effective local filesystem source definitions with:

- `id`
- `type`
- `rootUri`
- metadata containing `rootPath`
- metadata containing `excludePatterns`

WU-03 added runtime/CLI composition, but scan still returns capability-not-available. WU-04 should implement the source provider itself, not wire full indexing into CLI.

## Non-Goals

- Do not read Markdown file content.
- Do not compute document IDs.
- Do not compute document fingerprints.
- Do not compute chunk hashes.
- Do not chunk Markdown.
- Do not embed text.
- Do not write storage.
- Do not implement indexing queue behavior.
- Do not implement file watching.
- Do not implement `.gitignore` compatibility.
- Do not follow symlinks.
- Do not change CLI `scan` into a full indexing command in this work unit.

## Source Provider Behavior

`LocalFsSourceProvider` should implement `SourceProvider`.

It should:

- Accept a `SourceDefinition` with `type: "local-fs"`.
- Read `rootPath` from source metadata produced by effective config.
- Traverse the root directory recursively.
- Return candidates for `.md` and `.markdown` files.
- Return deterministic candidate ordering.
- Return `sourceId`, `uri`, `relativePath`, `fileType`, `updatedAt`, and `size`.
- Use filesystem metadata only.

It should ignore:

- hidden files and hidden directories
- `.git`
- `node_modules`
- `dist`
- `build`
- `.DS_Store`
- symlinks
- non-Markdown files
- paths matching user exclude regex patterns

If the source type is unsupported, it should fail with a structured source error.

If the root path is missing or invalid, it should fail with a structured source error.

If the root path does not exist or is not a directory, it should fail with a structured source error. Later app/runtime code can decide how to display this status.

## Metadata Contract

WU-04 can rely on effective config storing source metadata like this:

- `metadata.rootPath`: normalized absolute local filesystem path
- `metadata.excludePatterns`: user regex strings

The source provider should validate this metadata before scanning. It should not parse user config directly and should not depend on `src/config`.

## Relative Path and URI Rules

Candidate paths should be stable and platform-conscious:

- `relativePath` is relative to the source root.
- Use Node path APIs for filesystem traversal.
- Normalize returned `relativePath` to `/` separators so downstream document identity can be platform-stable.
- `uri` should be a `file://` URI using `pathToFileURL`.
- `fileType` should be `"markdown"` for both `.md` and `.markdown`.
- `updatedAt` should be `mtimeMs`.
- `size` should be file size in bytes.

## Error Semantics

Create source-owned errors if needed.

Recommended error codes:

- `SOURCE_UNSUPPORTED_TYPE`
- `SOURCE_ROOT_MISSING`
- `SOURCE_ROOT_INVALID`
- `SOURCE_SCAN_FAILED`

Errors should include:

- machine-readable code
- human-readable message
- source ID when available
- path when relevant

Do not reuse config errors for source scanning failures.

## File Responsibilities

Expected files:

- `src/sources/errors.ts`
  - Own structured source errors.

- `src/sources/local-fs.ts`
  - Own `LocalFsSourceProvider`.
  - Own traversal, ignore logic, supported extension logic, metadata extraction, and candidate creation.

- `src/sources/index.ts`
  - Re-export source contracts and local provider APIs intended for current use.

- `src/sources/local-fs.test.ts`
  - Own fixture-style integration tests using temporary directories.

Existing files may change:

- `src/index.ts`
  - Export source provider APIs if useful for current package surface.

## Testing Strategy

Tests should use temporary directories and real filesystem metadata.

Cover:

- `.md` and `.markdown` files are returned.
- non-Markdown files are ignored.
- candidates include `sourceId`, `uri`, normalized `relativePath`, `fileType`, `updatedAt`, and `size`.
- candidate ordering is deterministic.
- hidden files and hidden directories are ignored.
- `.git`, `node_modules`, `dist`, `build`, and `.DS_Store` are ignored.
- user exclude regex patterns are honored.
- symlinks are not followed.
- unsupported source type returns structured source error.
- missing `rootPath` metadata returns structured source error.
- missing source directory returns structured source error.

Acceptance should focus on `LocalFsSourceProvider.scan(sourceDefinition)` directly. CLI scan should remain capability-not-available until indexing work wires source discovery into runtime behavior.

## Implementation Tasks

### Task 1: [x] Define Source Errors and Public Exports

**Files:**

- Create: `src/sources/errors.ts`
- Create: `src/sources/index.ts`
- Modify: `src/index.ts` if useful

Plan:

- Add source-owned structured error type and helper.
- Re-export source contracts and error helpers from `src/sources/index.ts`.
- Avoid importing config, app, CLI, storage, indexing, processors, embeddings, or query modules.

Validation:

- Typecheck passes.
- Source errors are source-owned and not config-owned.

### Task 2: [x] Implement LocalFsSourceProvider Metadata Validation

**Files:**

- Create: `src/sources/local-fs.ts`
- Create: `src/sources/local-fs.test.ts`

Plan:

- Implement `SourceProvider.scan`.
- Reject non-`local-fs` source types.
- Extract and validate `metadata.rootPath`.
- Extract `metadata.excludePatterns` as regex strings when present.
- Compile exclude regex patterns defensively.

Validation:

- Tests cover unsupported source type, missing root metadata, and invalid root directory.

### Task 3: [x] Implement Recursive Markdown Discovery

**Files:**

- Modify: `src/sources/local-fs.ts`
- Modify: `src/sources/local-fs.test.ts`

Plan:

- Traverse directories recursively with Node filesystem APIs.
- Do not follow symlinks.
- Include `.md` and `.markdown` files.
- Ignore non-Markdown files.
- Build candidate metadata from stat data only.
- Sort final candidates by normalized relative path.

Validation:

- Tests cover supported extensions, ignored extensions, candidate fields, deterministic ordering, and normalized relative paths.

### Task 4: [x] Implement Ignore and Exclude Rules

**Files:**

- Modify: `src/sources/local-fs.ts`
- Modify: `src/sources/local-fs.test.ts`

Plan:

- Ignore hidden files/directories.
- Ignore `.git`, `node_modules`, `dist`, `build`, and `.DS_Store`.
- Apply user exclude regex patterns to normalized relative paths.
- Keep rules simple; do not implement `.gitignore`.

Validation:

- Tests cover default ignores, user exclude patterns, and symlink skip behavior.

### Task 5: [x] Boundary and Regression Validation

**Files:**

- Create or update source boundary tests if useful.
- Modify existing tests only if needed.

Plan:

- Ensure source module does not import config, app, CLI, storage, indexing, processors, embeddings, or query.
- Ensure existing runtime and CLI behavior remains unchanged.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- CLI `scan --config <path>` still returns `APP_CAPABILITY_NOT_AVAILABLE` until indexing/runtime wiring exists.

### Task 6: [x] Mark WU-04 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/04-local-fs-source-discovery.md`

Plan:

- During implementation, move WU-04 status through `implementing` and `testing`.
- After validation passes, mark WU-04 as `[x] Status: passed`.
- Mark all checklist tasks in this plan as complete.
- Commit this work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `git status --short` shows only expected files before commit and is clean after commit.

## Success Check

WU-04 is successful only if:

- `LocalFsSourceProvider.scan` can scan a real temporary source directory.
- It returns deterministic Markdown document candidates with required metadata.
- It does not read file contents.
- It ignores hidden paths, default ignored directories/files, non-Markdown files, user-excluded paths, and symlinks.
- It returns structured source errors for unsupported source type and invalid root metadata/directory.
- Source module stays independent of config, app, CLI, storage, indexing, processors, embeddings, and query modules.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If source errors/exports are missing, resume at Task 1.
- If provider exists but metadata validation is missing, resume at Task 2.
- If traversal is missing or incomplete, resume at Task 3.
- If ignore/exclude behavior is incomplete, resume at Task 4.
- If behavior works but boundary/regression checks are missing, resume at Task 5.
- If validation passed but docs are not marked complete, resume at Task 6.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan keeps source discovery separate from indexing.
- [x] The plan uses source definitions/effective metadata instead of parsing config.
- [x] The plan covers Markdown extension support, ignore rules, exclude rules, symlink behavior, and structured errors.
- [x] The plan defines WU-04-specific observable behavior through direct provider tests.
- [x] The plan leaves CLI scan as capability-not-available until later runtime/indexing work.
