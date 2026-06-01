# Runtime Composition and CLI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first app/runtime composition layer over config loading and expose CLI command routing that proves adapters call Core runtime services rather than owning core logic.

**Architecture:** The CLI remains a development and validation adapter. `src/app` owns runtime composition and lifecycle semantics. WU-03 should connect WU-02 config loading to app/runtime, but it should not implement source scanning, indexing, storage, embedding, query, or MCP.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, existing config module from WU-02.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

Use code examples only for command shapes and sample JSON output. Do not treat examples as complete implementation templates.

## Source Documents

- `docs/02_architecture.md`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#2-core-boundary`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#3-adapter-rule`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#4-registration-model`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#6-runtime-and-lifecycle`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/02-config-loading-and-effective-config.md`

## Current Starting Point

WU-02 created:

- `src/config/config.ts`
- `src/config/contracts.ts`
- `src/config/effective.ts`
- `src/config/errors.ts`
- `src/config/load.ts`
- `src/config/validate.ts`
- `loadEffectiveConfigFile(filePath)`

Current CLI state:

- `mindweave health` prints runtime health.
- Unknown commands print usage.
- CLI imports only `src/app/runtime`.

WU-03 should preserve that boundary while adding command routing over app/runtime.

## Non-Goals

- Do not implement local filesystem source scanning.
- Do not implement startup scan behavior.
- Do not implement watchers.
- Do not implement indexing queue behavior.
- Do not implement SQLite storage opening.
- Do not implement embedding provider construction.
- Do not implement QueryService.
- Do not implement MCP server startup.
- Do not introduce a dependency injection framework.
- Do not add automatic provider discovery.
- Do not make CLI parse or validate config directly.
- Do not make CLI return fake successful scan/query results.

## Core Design Intent

WU-03 should establish three things:

1. A runtime creation API that loads effective config and records which capabilities are currently available.
2. A minimal runtime lifecycle surface that adapters can call consistently.
3. CLI command routing that delegates to app/runtime and reports capability gaps clearly.

The important result is the composition boundary, not downstream capability implementation.

## Runtime Semantics

The app module should provide a small composition API.

Recommended concepts:

- Runtime creation from a config path.
- Runtime creation from an already loaded effective config for tests.
- Runtime health/status inspection.
- Lifecycle methods for `start`, `scan`, `status`, and `query`.
- Structured capability errors for commands whose downstream services are not built yet.

Runtime should know:

- Effective config was loaded successfully.
- Which source definitions were configured.
- Which embedding/storage/MCP settings are structurally present.
- Which capabilities are unavailable in this work unit.

Runtime should not:

- Open storage.
- Contact embedding providers.
- Scan source roots.
- Start MCP.
- Start long-running processes.

## Capability Error Semantics

Commands that depend on later work units should fail explicitly, not pretend success.

Recommended error category:

- `APP_CAPABILITY_NOT_AVAILABLE`

Expected examples:

- `scan` should report that indexing/source discovery is not available yet.
- `query` should report that query service/vector storage is not available yet.
- `start` should report that full runtime startup is not available yet.
- `status` can return config/runtime status if implemented without storage, or report that storage-backed status is unavailable. Prefer returning a small config/runtime status because it provides a useful WU-03 observable result without over-implementing later modules.

Errors should be structured enough for CLI, Tauri, and MCP adapters later:

- machine-readable code
- human-readable message
- optional command/capability hint

CLI may format those errors as JSON for now.

## CLI Command Shape

CLI should support these command forms:

```text
mindweave health
mindweave status --config <path>
mindweave start --config <path>
mindweave scan --config <path>
mindweave query --config <path> "<query>"
```

Keep parsing intentionally small and explicit. Do not introduce a CLI framework unless implementation pressure proves it necessary.

Config path behavior:

- Commands that need runtime composition must require `--config <path>` in WU-03.
- Do not decide final default config file location in this work unit.
- Missing `--config` should produce a structured CLI usage error.
- Relative config paths should be resolved by config loading and runtime composition consistently with WU-02 behavior.

Output behavior:

- Prefer stable JSON lines for command results and errors.
- `health` may keep the existing JSON health output.
- `status --config <path>` should prove config was loaded through runtime composition.
- Capability-not-available commands should return non-zero exit codes.

## File Responsibilities

Expected app files:

- `src/app/contracts.ts`
  - Extend app-owned runtime contracts only as needed.
  - Own app-level command result and app-level capability error shapes.
  - Should not import CLI types.

- `src/app/errors.ts`
  - Own structured app/runtime errors if separate from contracts.
  - Should avoid coupling app errors to config implementation details.

- `src/app/runtime.ts`
  - Own runtime creation and lifecycle behavior.
  - Load effective config through the config module when given a config path.
  - Expose methods that CLI/MCP/Tauri can call later.
  - Return clear capability errors for unimplemented downstream services.

- `src/app/runtime.test.ts`
  - Prove runtime can be created from config.
  - Prove runtime status summarizes configured sources without starting indexing.
  - Prove scan/start/query fail with structured capability errors.

Expected CLI files:

- `src/interfaces/cli/main.ts`
  - Own CLI argument parsing and output formatting only.
  - Must call app/runtime APIs for runtime operations.
  - Must not import config directly if runtime APIs can handle config path loading.
  - Must not import sources, processors, embeddings, storage, query, or indexing.

- `src/interfaces/cli/main.test.ts`
  - Prove command routing and output behavior.
  - Prove missing config path returns a clear usage error.
  - Prove status uses a real JSONC config file and returns runtime-composed status.
  - Prove start/scan/query route through runtime and return capability-not-available errors.
  - Preserve import boundary checks.

Existing files may change:

- `src/index.ts`
  - Export app/runtime APIs intended as current package surface.

## Status Result Shape

WU-03 should define a small runtime status result.

It should include:

- runtime name
- runtime status such as `configured`
- source count
- configured source summaries
- embedding provider/model identity
- storage type
- MCP enabled flag
- unavailable capabilities list

It should not include:

- indexed document count
- chunk count
- embedding count
- queue depth
- watcher status
- SQLite health
- query readiness beyond a simple unavailable capability marker

Those require later modules and should not be faked.

## Testing Strategy

Tests should validate WU-03 behavior through the real runtime and CLI paths.

Runtime tests:

- Create a temporary JSONC config file.
- Call runtime creation from config path.
- Assert status includes source count, source summaries, embedding model, storage type, MCP enabled flag.
- Assert `start`, `scan`, and `query` return or throw structured capability errors.
- Assert lifecycle `stop` is safe even if no downstream services are running.

CLI tests:

- `health` preserves existing output.
- `status --config <path>` prints stable JSON status loaded via app/runtime.
- `scan --config <path>` returns non-zero and prints `APP_CAPABILITY_NOT_AVAILABLE`.
- `start --config <path>` returns non-zero and prints `APP_CAPABILITY_NOT_AVAILABLE`.
- `query --config <path> "hello"` returns non-zero and prints `APP_CAPABILITY_NOT_AVAILABLE`.
- Missing `--config` returns non-zero and a structured usage error.
- CLI source text does not import config, storage, source scanning, processors, embeddings, indexing, or query modules directly.

Acceptance should focus on a real config file reaching runtime-composed behavior. CLI health is only a regression check.

## Implementation Tasks

### Task 1: [x] Define App Runtime Result and Error Contracts

**Files:**

- Modify: `src/app/contracts.ts`
- Create: `src/app/errors.ts` if useful

Plan:

- Add app-owned runtime status, command result, and capability error shapes.
- Keep the contract protocol-neutral.
- Avoid leaking CLI formatting concerns into app contracts.

Validation:

- Typecheck passes.
- Contracts do not import CLI or downstream implementation modules.

### Task 2: [x] Implement Runtime Composition Over Config

**Files:**

- Modify: `src/app/runtime.ts`
- Modify: `src/app/runtime.test.ts`

Plan:

- Add runtime creation from config path.
- Add runtime creation from effective config if useful for tests.
- Use `loadEffectiveConfigFile` from the config module.
- Store effective config inside the runtime instance.
- Provide runtime status from effective config only.
- Implement `stop` as safe no-op for now.

Validation:

- Runtime tests prove real JSONC config reaches runtime status.
- Runtime tests prove no source scanning/storage/provider behavior is required.

### Task 3: [x] Add Capability-Not-Available Behavior

**Files:**

- Modify: `src/app/runtime.ts`
- Modify: `src/app/runtime.test.ts`

Plan:

- Add explicit behavior for `start`, `scan`, and `query` while downstream modules are absent.
- Return or throw structured `APP_CAPABILITY_NOT_AVAILABLE` errors.
- Keep `status` useful using config-derived runtime status.

Validation:

- Runtime tests prove unsupported capabilities are explicit and machine-readable.

### Task 4: [x] Implement CLI Command Routing

**Files:**

- Modify: `src/interfaces/cli/main.ts`
- Modify: `src/interfaces/cli/main.test.ts`

Plan:

- Add explicit command parsing for `status`, `start`, `scan`, and `query`.
- Require `--config <path>` for runtime-composed commands.
- Route commands through app/runtime APIs.
- Format results and errors as stable JSON lines.
- Keep `health` behavior compatible.

Validation:

- CLI tests prove real config file usage through `status --config`.
- CLI tests prove capability errors for unimplemented commands.
- CLI boundary test proves no direct imports of config or downstream modules.

### Task 5: [x] Export Runtime Composition API

**Files:**

- Modify: `src/index.ts`

Plan:

- Export only the app/runtime API and types that are useful for current adapters/tests.
- Do not export CLI internals.

Validation:

- Typecheck passes.

### Task 6: [x] Mark WU-03 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/03-runtime-composition-and-cli-shell.md`

Plan:

- During implementation, move WU-03 status through `implementing` and `testing`.
- After validation passes, mark WU-03 as `[x] Status: passed`.
- Mark all checklist tasks in this plan as complete.
- Commit this work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm cli health` remains a regression check.
- A CLI command using a real JSONC config file reaches runtime-composed status.
- Capability-not-available commands return clear structured errors.
- `git status --short` shows only expected files before commit and is clean after commit.

## Success Check

WU-03 is successful only if:

- Runtime can be created from a real JSONC config file.
- Runtime status reflects effective config without starting source scanning, storage, embeddings, query, or MCP.
- CLI `status --config <path>` reaches runtime-composed status through app/runtime.
- CLI `start`, `scan`, and `query` route through app/runtime and return structured capability-not-available errors.
- CLI remains a thin adapter and does not import config or downstream implementation modules directly.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If contracts are missing, resume at Task 1.
- If runtime cannot load config yet, resume at Task 2.
- If start/scan/query behavior is unclear, resume at Task 3.
- If runtime works but CLI does not route commands, resume at Task 4.
- If public exports are incomplete, resume at Task 5.
- If validation passed but docs are not marked complete, resume at Task 6.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan keeps CLI as an adapter.
- [x] The plan keeps runtime composition in `src/app`.
- [x] The plan uses WU-02 config pipeline instead of duplicating config loading in CLI.
- [x] The plan avoids implementing source scanning, storage, embeddings, query, MCP, or watchers.
- [x] The plan defines WU-03-specific observable behavior using a real JSONC config file.
- [x] The plan makes `pnpm cli health` a regression check rather than the primary acceptance test.
