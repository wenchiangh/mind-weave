# Config Loading and Effective Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement JSONC user config loading, validation, and effective config derivation without starting indexing or writing runtime state back to user config.

**Architecture:** Config remains an input layer owned by `src/config`. It should validate user-editable settings, derive defaults, normalize source roots, and produce an effective config consumed by app composition and later modules. Config code may depend on shared/source contracts, but must not depend on storage, indexing, processors, embeddings implementations, or UI adapters.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, `jsonc-parser` for JSONC parsing, Zod for runtime validation.

---

## Planning Standard

This plan describes the implementation intent, constraints, validation matrix, and expected observable behavior. It should let an implementation agent generate logically consistent code; it should not force exact code text.

Use small code snippets only for config examples and commands. Do not treat examples as complete implementation templates.

## Source Documents

- `docs/02_architecture.md`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#5-configuration-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#7-source-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/01-core-contracts-and-module-boundaries.md`

## Current Starting Point

WU-01 created module contracts and a CLI boundary. WU-02 should build on those contracts and add the first real config module.

Relevant existing files:

- `src/shared/contracts.ts`
- `src/sources/contracts.ts`
- `src/app/contracts.ts`
- `src/app/runtime.ts`
- `src/interfaces/cli/main.ts`

## Non-Goals

- Do not implement source scanning.
- Do not implement `LocalFsSourceProvider`.
- Do not implement runtime composition.
- Do not implement storage source mirroring.
- Do not implement config mutation APIs.
- Do not edit user config files.
- Do not implement UI-driven config editing.
- Do not add file watching.
- Do not introduce a config service or HTTP API.
- Do not validate that source directories exist on disk yet unless it naturally falls out of path normalization. Discovery belongs to WU-04.

## Technology Choice

Use `jsonc-parser` for parsing JSON with comments and trailing commas. It is the Microsoft parser used by VS Code-related tooling and is a better fit than ad hoc comment stripping.

Use Zod for runtime validation because config is untrusted input and should produce typed output plus structured errors. Keep schemas local to the config module. Do not export Zod schemas as core domain contracts unless later work proves that useful.

Expected dependency addition:

```bash
pnpm add jsonc-parser zod
```

Do not pin versions manually in the plan. Let pnpm resolve current versions and record them in `pnpm-lock.yaml`.

## File Responsibilities

Create config-owned files:

- `src/config/contracts.ts`
  - Owns user config and effective config types.
  - Types here describe config module input/output, not storage rows or UI forms.
  - May import shared/source contracts for ID and source definition compatibility.

- `src/config/errors.ts`
  - Owns config error types and error formatting helpers.
  - Errors should be structured enough for CLI/UI later, not just raw strings.

- `src/config/load.ts`
  - Owns reading JSONC text from disk and parsing it into unknown user data.
  - Should separate "read file" from "parse text" so tests can validate parsing without filesystem setup.

- `src/config/validate.ts`
  - Owns runtime validation and conversion from parsed unknown data to typed user config.
  - Should use Zod or a similarly explicit validation layer.

- `src/config/effective.ts`
  - Owns defaulting, path normalization, source ID derivation, nested source rejection, and output effective config.
  - Should not read source files or query storage.

- `src/config/index.ts`
  - Re-exports the intended config module API.
  - Avoid exporting internal parser/schema details unless tests need them.

- `src/config/config.ts`
  - Owns the thin config-module pipeline from config file path to effective config.
  - Should compose load, validate, and effective derivation without starting runtime services.

Create tests near the config module:

- `src/config/config.test.ts`
- `src/config/load.test.ts`
- `src/config/validate.test.ts`
- `src/config/effective.test.ts`

Existing files may change only if needed:

- `src/index.ts`
  - May export config APIs if they are part of the current public package surface.

## Config Shape

WU-02 should define the minimal user config needed by near-term P0 work:

- sources
- embedding provider settings
- storage settings
- optional MCP settings
- optional logging/settings only if necessary for later runtime composition

Keep this shape intentionally small. The goal is to support P0 execution, not to design a complete product settings model.

Recommended user config concepts:

- `sources`: required non-empty array.
- Local filesystem source:
  - `type`: `local-fs`
  - `id`: optional string
  - `name`: optional string
  - `rootPath`: required string
  - `exclude`: optional string array of regex patterns
- Embedding:
  - provider type compatible with `openai-compatible`
  - model
  - base URL
  - API key environment variable name
  - optional dimensions
  - optional batch size
- Storage:
  - type compatible with `sqlite`
  - path
- MCP:
  - enabled flag, defaulting consistently with detailed design

Do not overfit this schema to Tauri or future UI editing. UI can edit the same config later, but WU-02 should stay core-first.

WU-02 should not decide the final default config file location for CLI, Tauri, or MCP adapters. The config module should support loading from an explicit path and deriving paths relative to that file. Adapter-level defaults belong to later runtime or interface work units.

## Effective Config Semantics

Effective config is the validated and normalized form used by Core runtime.

It should:

- Contain no comments.
- Contain no unresolved relative source roots.
- Contain defaults needed by runtime composition.
- Contain deterministic source IDs.
- Preserve user-provided source IDs exactly after validation.
- Generate missing source IDs from normalized absolute root paths.
- Normalize local filesystem paths consistently for macOS and later platform support.
- Reject nested local filesystem source roots.
- Compile or validate exclude regex patterns early enough to fail fast on invalid patterns.

It should not:

- Write generated IDs back into user config.
- Store runtime state.
- Contact embedding providers.
- Open SQLite.
- Scan source folders.
- Check file contents.

Embedding, storage, and MCP settings should receive structural validation only. Do not verify provider availability, API key validity, SQLite openability, or MCP runtime availability in this work unit.

## Source ID Rule

If a source has an explicit ID:

- Validate it is non-empty and stable as a string.
- Use it as the effective source ID.

If a source omits ID:

- Normalize its absolute root path.
- Generate a deterministic ID from that normalized absolute path.
- Generated IDs may change when the root path changes; this is accepted by design.

Use the existing project direction: generated source IDs are a convenience, explicit IDs are recommended when stable identity matters.

Source names are display metadata only. A generated default name may be useful, but source identity must depend only on explicit source ID or the generated ID from normalized root path.

## Path Normalization Rule

WU-02 should create a single path normalization helper inside the config module or a small shared helper if implementation pressure suggests reuse.

For local filesystem sources:

- Resolve relative paths from a deterministic base.
- The base should be the config file directory when loading from a file.
- Tests should also support passing an explicit base directory for in-memory config validation.
- Normalize path separators through Node path utilities instead of string replacement.
- Convert effective source root to an absolute normalized path and root URI.

Avoid relying on current working directory except where an explicit caller chooses it.

## Nested Source Rejection

Reject source configurations where one local filesystem root contains another local filesystem root.

Important cases:

- Same path repeated.
- Parent contains child.
- Child contains parent.
- Relative paths that normalize into nested absolute paths.
- Trailing slash differences.
- Different source IDs do not make nesting acceptable.

Only compare local filesystem sources. Future non-filesystem source types can define their own conflict rules later.

## Validation Errors

Errors should be actionable enough for CLI/UI later:

- Include a machine-readable code.
- Include a human-readable message.
- Include a path or field hint when practical.
- Preserve parser errors from JSONC with location information when available.

Recommended error categories:

- file read failure
- JSONC parse failure
- schema validation failure
- invalid regex
- nested sources
- unsupported source/storage/embedding type

Do not make callers parse free-form strings to determine failure kind.

## Dependency Rules

Allowed dependencies:

- `src/config/*` may import `src/shared/contracts`.
- `src/config/*` may import `src/sources/contracts` if reusing source identity/status types improves consistency.
- `src/app/*` may later import config APIs, but WU-02 does not need to wire runtime composition yet.

Forbidden dependencies:

- Config module must not import storage implementation.
- Config module must not import indexing.
- Config module must not import processors.
- Config module must not import embeddings implementation.
- Config module must not import CLI/MCP adapters.
- Config module must not write runtime state into user config.

## Testing Strategy

Tests should prove config behavior directly, without requiring source folders to contain real Markdown files.

Test groups:

- JSONC parsing:
  - comments allowed
  - trailing commas allowed
  - invalid JSONC returns structured parse error

- Schema validation:
  - missing required `sources`
  - empty source list rejected
  - unsupported source type rejected
  - invalid embedding/storage type rejected
  - invalid dimensions/batch size rejected when present

- Effective config:
  - valid minimal config receives defaults
  - explicit source ID is preserved
  - missing source ID is deterministic from normalized absolute root
  - relative source root resolves from config directory or explicit base directory
  - source name default is deterministic if name is omitted
  - exclude regex strings are accepted when valid
  - invalid exclude regex fails with structured error

- Nested sources:
  - duplicate roots rejected
  - parent/child rejected
  - normalized relative roots rejected when nested after resolution
  - non-nested sibling roots accepted

- Boundary:
  - Config tests do not require storage, indexing, source scanning, or provider APIs.
  - Existing runtime and CLI health tests continue to pass.

## Implementation Tasks

### Task 1: [x] Add Config Dependencies

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

Plan:

- Add `jsonc-parser` and `zod` as runtime dependencies.
- Keep dev tooling unchanged.
- Do not add config-specific CLI commands yet.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.

### Task 2: [x] Define Config Contracts and Errors

**Files:**

- Create: `src/config/contracts.ts`
- Create: `src/config/errors.ts`

Plan:

- Define user config and effective config types owned by the config module.
- Keep types minimal and P0-focused.
- Define structured config errors.
- Avoid exporting Zod schema internals as public contract.

Validation:

- Config contracts can represent local filesystem sources, storage, embedding, and MCP settings.
- Error types can represent parse, validation, regex, nested source, unsupported type, and file read failures.
- `pnpm typecheck` passes.

### Task 3: [x] Implement JSONC Loading Boundary

**Files:**

- Create: `src/config/load.ts`
- Create: `src/config/load.test.ts`

Plan:

- Separate reading a file from parsing a JSONC string.
- JSONC parser should accept comments and trailing commas.
- Parser failures should become structured config errors.
- File read failures should become structured config errors.

Validation:

- Tests cover valid JSONC, comments, trailing commas, invalid JSONC, and missing file behavior.
- Tests should not depend on indexing or storage.

### Task 4: [x] Implement Schema Validation

**Files:**

- Create: `src/config/validate.ts`
- Create: `src/config/validate.test.ts`

Plan:

- Validate parsed unknown data into a typed user config.
- Reject unsupported source, storage, and embedding types.
- Reject missing or malformed required fields.
- Keep user config separate from effective config.

Validation:

- Tests cover required fields, unsupported types, invalid dimensions/batch size, and malformed source entries.
- Validation errors include useful code and field/path hints.

### Task 5: [x] Implement Effective Config Derivation

**Files:**

- Create: `src/config/effective.ts`
- Create: `src/config/effective.test.ts`

Plan:

- Derive defaults.
- Resolve and normalize local filesystem roots.
- Generate deterministic source IDs when omitted.
- Preserve explicit source IDs.
- Produce source definitions compatible with source contracts.
- Do not scan source folders or write generated IDs back to config.

Validation:

- Tests cover deterministic generated IDs, explicit ID preservation, relative path resolution, default source name, root URI generation, and default MCP behavior.

### Task 6: [x] Implement Nested Source and Regex Validation

**Files:**

- Modify: `src/config/effective.ts`
- Modify: `src/config/effective.test.ts`

Plan:

- Validate user exclude regex patterns before returning effective config.
- Reject duplicate and nested local filesystem roots after normalization.
- Keep this logic in config/effective layer because it depends on normalized roots and source definitions.

Validation:

- Tests cover valid regex, invalid regex, duplicate roots, parent/child roots, normalized nested relative roots, and accepted sibling roots.

### Task 7: [x] Public Config Module Export and Boundary Checks

**Files:**

- Create: `src/config/index.ts`
- Modify: `src/index.ts` if exposing config APIs is useful for current package surface.
- Create or update config boundary tests if useful.

Plan:

- Export only the intended config API.
- Keep parser/schema helpers internal unless tests need direct imports.
- Ensure config module does not import adapters, storage implementation, indexing, processors, or provider implementation.

Validation:

- Import inspection or source-text tests prove config has no forbidden dependencies.
- Existing CLI boundary test continues to pass.
- `pnpm typecheck` and `pnpm test` pass.

### Task 8: [x] Add Config Pipeline Acceptance Tests

**Files:**

- Create: `src/config/config.ts`
- Create: `src/config/config.test.ts`
- Modify: `src/config/index.ts`
- Modify: `src/index.ts` if exposing the config pipeline is useful for current package surface.

Plan:

- Add a thin config-module API that loads a JSONC file, validates user config, and returns effective config.
- Keep this API inside the config module. It must not start indexing, open storage, contact providers, or depend on CLI/runtime adapters.
- Treat this as the primary observable WU-02 behavior.

Validation:

- A temporary JSONC config file with comments and trailing commas loads into deterministic effective config.
- Relative source roots resolve from the config file directory.
- Invalid config files return structured `ConfigError` values.

### Task 9: [x] Mark WU-02 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/02-config-loading-and-effective-config.md`

Plan:

- During implementation, move WU-02 status through `implementing` and `testing`.
- After validation passes, mark WU-02 as `[x] Status: passed`.
- Mark all checklist steps in this plan as complete.
- Commit the work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm cli health` still prints the runtime health JSON as a regression check.
- `git status --short` shows only expected files before commit and is clean after commit.

## Success Check

WU-02 is successful only if:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- A real JSONC config file can be loaded into deterministic effective config through a config-module API.
- Invalid config files return structured `ConfigError` values through the same config-module API.
- `pnpm cli health` prints `{"name":"mind-weave-core","status":"ok"}` as a regression check for the existing CLI stub.
- JSONC config loading accepts comments and trailing commas.
- Invalid JSONC and invalid schema produce structured config errors.
- Effective config preserves explicit source IDs.
- Effective config deterministically generates missing source IDs from normalized absolute roots.
- Nested local filesystem sources are rejected.
- Invalid exclude regex patterns are rejected.
- Config module does not import storage, indexing, processors, embedding implementation, or interface adapters.
- WU-02 status in `04_execution_index.md` is marked as passed after implementation.

## Recovery Notes

If execution is interrupted:

- If dependencies are added but config contracts do not exist, resume at Task 2.
- If config contracts exist but JSONC parsing is missing, resume at Task 3.
- If parsing exists but schema validation is missing, resume at Task 4.
- If validation exists but effective config derivation is missing, resume at Task 5.
- If effective config exists but nested source/regex checks are missing, resume at Task 6.
- If implementation exists but exports/boundary checks are missing, resume at Task 7.
- If config pipeline acceptance tests are missing, resume at Task 8.
- If validation passed but docs are not marked complete, resume at Task 9.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include full implementation code.
- [x] The plan identifies parser and validator choices.
- [x] The plan keeps config loading separate from runtime state.
- [x] The plan covers JSONC parsing, schema validation, effective config derivation, source ID generation, nested source rejection, and regex validation.
- [x] The plan keeps WU-02 separate from source scanning and runtime composition.
- [x] The plan defines objective success checks.
