# Core Contracts and Module Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the minimal TypeScript contract layer and module boundaries that later P0 work units can implement without coupling adapters to concrete internals.

**Architecture:** Contracts should live with the modules that own the domain concept. Interface adapters should depend on app/runtime or service contracts, not concrete source, storage, processor, embedding, or query implementations. This work unit creates the shape of the system, not the implementations of the system.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, module-owned TypeScript contracts.

---

## Planning Standard

This plan intentionally describes implementation intent, boundaries, and validation criteria. It should guide an implementation that is logically consistent with the architecture; it should not force generated code to match exact code text.

Use code only where naming is itself a design constraint. Otherwise, prefer clear semantic requirements over full interface bodies.

## Source Documents

- `docs/02_architecture.md`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/00-project-skeleton-and-tooling.md`

## Current Starting Point

WU-00 created:

- `src/app/runtime.ts`
- `src/app/runtime.test.ts`
- `src/interfaces/cli/main.ts`
- `src/interfaces/cli/main.test.ts`
- `src/index.ts`
- project tooling with pnpm, tsgo, tsx, and Vitest

WU-01 should preserve the existing health command behavior while adding the contract layer.

## Non-Goals

- Do not implement config loading.
- Do not implement `LocalFsSourceProvider`.
- Do not implement `MarkdownProcessor`.
- Do not implement `OpenAICompatibleEmbeddingProvider`.
- Do not implement `SQLiteStorage`.
- Do not implement `QueryService`.
- Do not implement `IndexingService`.
- Do not implement MCP.
- Do not add dependency injection frameworks.
- Do not add automatic module discovery, plugin manifests, or runtime provider loading.
- Do not design the full SQLite schema.
- Do not introduce branded ID types unless a later work unit proves they are needed.

## File Responsibilities

Create focused contract files owned by their modules:

- `src/shared/contracts.ts`
  - Shared primitive aliases and lightweight result/status shapes that are genuinely cross-module.
  - Examples of acceptable concepts: ID-like string aliases, URI/path aliases, JSON metadata, timestamp aliases, common status strings.
  - This file must not become a dumping ground for domain objects that belong to a specific module.

- `src/sources/contracts.ts`
  - Source discovery contracts.
  - Owns source identity, source status, source configuration shape at the contract level, and document candidate shape.
  - Source discovery must represent candidates and events, not content reading or indexing.

- `src/processors/contracts.ts`
  - Document processing contracts.
  - Owns raw document input and chunk output shape.
  - Processor output should be storage- and embedding-agnostic.

- `src/embeddings/contracts.ts`
  - Embedding provider contracts.
  - Owns document/query embedding request and response shapes.
  - Contracts should support batch document embeddings and query embeddings without tying to OpenAI-specific SDK types.

- `src/storage/contracts.ts`
  - Storage service contract boundaries.
  - Should express the storage capabilities later modules need, but avoid a giant one-size-fits-all interface.
  - It is acceptable to split storage capabilities by concern, such as source status reads, document/chunk writes, vector search, and maintenance.

- `src/query/contracts.ts`
  - Protocol-neutral query input and result shapes.
  - Query results should contain chunk text, normalized score, IDs, source/document traceability, and status metadata.
  - No MCP-specific response shape belongs here.

- `src/indexing/contracts.ts`
  - Index job and indexing service boundary contracts.
  - Owns job types, job status, and high-level indexing service capabilities.
  - Should not own source scanning or storage implementation details.

- `src/app/contracts.ts`
  - App/runtime composition contracts.
  - Owns runtime lifecycle surface and health/status surface available to adapters.
  - Should describe services as dependencies without constructing concrete implementations.

Update existing files only as needed:

- `src/app/runtime.ts`
  - May import app contracts and continue exposing the existing health behavior.

- `src/interfaces/cli/main.ts`
  - Should continue calling app/runtime only.
  - Must not import source, storage, processor, embedding, indexing, or query concrete modules.

- `src/index.ts`
  - Should export the public app health/runtime contract surface needed at this stage.
  - Avoid exporting every internal contract unless there is a clear reason.

## Contract Design Guidance

Contracts created in WU-01 are internal P0 contracts. They are meant to make module boundaries explicit for implementation, not to freeze a public API. Later work units may adjust them when implementation constraints become clearer, as long as the architectural boundaries remain intact.

WU-01 should not define the full user config or effective config schema. Config loading, validation, defaults, and nested source rejection belong to WU-02.

### Shared Concepts

Prefer simple type aliases over heavy abstractions.

Recommended style:

- IDs can start as `string` aliases.
- URI/path values can start as `string` aliases.
- Timestamps can be represented consistently as number milliseconds or ISO strings; choose one and document the choice in the contract file.
- JSON metadata should be typed narrowly enough to avoid `any`, but not so narrowly that every future source needs contract churn.

Avoid:

- Branded ID types in WU-01.
- Generic framework-like result monads.
- Global domain objects in `shared`.

### Source Contracts

Source contracts should represent discovery, not indexing.

They should be able to express:

- A configured source identity.
- Source type, initially compatible with `local-fs`.
- Source status such as active, disabled, or error.
- A document candidate with source ID, URI, relative path, file type, updated time, and size.
- Scan output that can later be consumed by indexing.

They must not express:

- File content reading.
- Chunking.
- Embedding.
- Storage writes.
- Vector search.

### Processor Contracts

Processor contracts should represent conversion from raw natural-language document content into retrievable chunks.

They should be able to express:

- Raw document input with document identity, source identity, file type, content, and source metadata.
- Chunk output with text, chunk index, content hash when available, and optional position/source metadata.
- Processor selection by file type or document type.

They must not express:

- Embedding vectors.
- Database row shapes.
- Query score fields.
- Markdown graph relationships.

### Embedding Contracts

Embedding contracts should describe provider-independent vector generation.

They should be able to express:

- Active embedding config identity at the contract level: provider, model, optional dimensions.
- Batch document chunk embedding.
- Query embedding.
- Provider error categories that later code can map into retry/non-retry behavior.

They must not express:

- OpenAI SDK-specific response objects.
- Storage persistence details.
- Reranking.
- Multiple active provider routing.

### Storage Contracts

Storage contracts should expose domain operations rather than SQL.

They should be split enough that a future implementation does not require one enormous interface. A good implementation can define several focused capability interfaces and compose them where needed.

WU-01 should define storage capability boundaries first, not a complete persistence API. Exact method sets can evolve in WU-07 and WU-08 when SQLite and sqlite-vec behavior is implemented.

They should be able to express:

- Source mirror/status reads and writes.
- Document registry operations.
- Chunk replacement ownership.
- Embedding metadata persistence.
- Vector search capability boundary.
- Soft delete and status updates.
- Index configuration status.

They should avoid:

- Exact SQLite table columns.
- sqlite-vec virtual table details.
- Raw SQL leaking into callers.
- Methods that assume only filesystem documents forever.

### Query Contracts

Query contracts should stay protocol-neutral.

They should be able to express:

- Query text.
- Limit.
- Include and exclude source filters.
- File type filters.
- Score threshold.
- Query results with chunk text, score, IDs, source/document path or URI, statuses, and timestamps.

They must not express:

- MCP tool schemas.
- Generated explanations.
- Summaries.
- Reranking debug payloads.

### Indexing Contracts

Indexing contracts should define the synchronization boundary without implementing queue behavior yet.

They should be able to express:

- `upsert-document` and `delete-document` job intent.
- Job identity and document target identity.
- Job status categories that later code can track.
- Service-level operations such as enqueueing document work, scanning a source, or draining pending work.

They must not express:

- Concrete filesystem watcher APIs.
- Concrete storage transaction implementation.
- Concrete markdown processing implementation.

### App Runtime Contracts

App contracts should express lifecycle and adapter-facing surfaces.

They should be able to express:

- Runtime health.
- Runtime start and stop lifecycle.
- The idea of a composed service container without requiring a dependency injection framework.
- Adapter-safe operations that future CLI/MCP/Tauri layers can call.

They must not express:

- Concrete provider construction.
- Concrete config parsing.
- Direct module discovery.

## Dependency Rules

Implement WU-01 with these dependency directions:

- `interfaces/*` may import app/runtime or app contracts.
- `app/*` may import module contracts.
- Module contract files may import `shared/contracts`.
- Module contract files should not import each other unless the relationship is essential and directional.
- `shared/contracts` must not import module contracts.

Forbidden dependencies in WU-01:

- CLI importing storage contracts directly.
- CLI importing source contracts directly.
- CLI importing processor, embedding, indexing, or query contracts directly.
- Storage contracts importing source provider implementation concepts.
- Query contracts importing MCP concepts.

Do not add a dependency-boundary tool in this work unit. Use focused tests and simple import review instead.

## Testing Strategy

WU-01 tests should prove the contracts are usable and that current adapter boundaries remain intact.

Recommended test types:

- Contract implementation tests with small fake implementations.
  - A fake source provider can satisfy the source discovery contract without reading content.
  - A fake processor can turn a raw document into chunks without storage or embeddings.
  - A fake embedding provider can return deterministic vectors without network access.
  - A fake storage object can satisfy focused storage capability contracts without SQLite.
  - A fake query service can return protocol-neutral query results without MCP.

- Runtime/adapter regression tests.
  - Existing runtime health behavior should continue to pass.
  - Existing CLI health behavior should continue to pass.

- Boundary tests.
  - Use lightweight source-text inspection or import-level tests to ensure `src/interfaces/cli/main.ts` does not import storage/source/processor/embedding/indexing/query modules.
  - This is intentionally simple; do not introduce a boundary checking dependency yet.

Do not test real provider APIs, real filesystem discovery, SQLite, sqlite-vec, or MCP in WU-01.

## Implementation Tasks

### Task 1: Shared Primitive Contracts

**Files:**

- Create: `src/shared/contracts.ts`
- Create or update tests near the shared module if behavior exists.

Plan:

- Define only primitive cross-module aliases and lightweight common shapes.
- Keep module-specific concepts out of shared.
- Prefer simple string/number aliases over branded or class-based types.
- Add a short comment only if it prevents misuse, such as documenting timestamp representation.

Validation:

- `pnpm typecheck` passes.
- Any shared contract test should verify compile-time usability, not runtime behavior that does not exist.

### Task 2: Source and Processor Contracts

**Files:**

- Create: `src/sources/contracts.ts`
- Create: `src/processors/contracts.ts`
- Create focused contract tests if useful.

Plan:

- Source contracts should describe discovery and document candidates only.
- Processor contracts should describe raw document input and chunk output only.
- Avoid coupling source candidates directly to processor input if a small conversion step will be clearer later.
- Keep future non-file documents possible by not hardcoding every identity concept to filesystem paths.

Validation:

- A fake source provider can return a Markdown candidate using the contract.
- A fake processor can accept document content and return chunk text.
- No source contract imports processor contracts.
- No processor contract imports source provider implementation concepts.

### Task 3: Embedding and Query Contracts

**Files:**

- Create: `src/embeddings/contracts.ts`
- Create: `src/query/contracts.ts`
- Create focused contract tests if useful.

Plan:

- Embedding contracts should be provider-neutral and support document chunk embedding plus query embedding.
- Query contracts should describe protocol-neutral input and output.
- Do not include OpenAI SDK response shapes.
- Do not include MCP schema fields or generated reasoning fields.

Validation:

- A fake embedding provider can return deterministic numeric vectors.
- A fake query service can return chunk text, normalized score, and traceability metadata.
- Query contracts do not import MCP/interface modules.

### Task 4: Storage and Indexing Contracts

**Files:**

- Create: `src/storage/contracts.ts`
- Create: `src/indexing/contracts.ts`
- Create focused contract tests if useful.

Plan:

- Storage contracts should expose domain operations, not SQL.
- Split storage capabilities by concern if that keeps contracts small.
- Indexing contracts should describe job intent and service boundaries, not queue implementation.
- Keep `upsert-document` and `delete-document` as the only core job types at this stage.

Validation:

- A fake storage implementation can satisfy source/document/chunk/query capability contracts without SQLite.
- A fake indexing service can accept upsert/delete intent without knowing filesystem watcher APIs.
- Storage contracts do not expose SQL or sqlite-vec implementation details.

### Task 5: App Runtime Contracts and Existing Runtime Alignment

**Files:**

- Create: `src/app/contracts.ts`
- Modify: `src/app/runtime.ts`
- Modify: `src/app/runtime.test.ts` only if needed.
- Modify: `src/index.ts` only if needed.

Plan:

- Move or mirror runtime health shape into app contracts.
- Keep existing `getRuntimeHealth` behavior stable.
- Introduce runtime lifecycle contract shape only as a boundary; do not implement full start/stop behavior.
- Keep app contracts suitable for CLI, MCP, and future Tauri adapters.

Validation:

- Existing runtime health test still passes.
- Typecheck proves runtime implementation matches its contract.

### Task 6: CLI Boundary Regression

**Files:**

- Modify or add CLI boundary tests.
- Existing file: `src/interfaces/cli/main.test.ts`

Plan:

- Preserve CLI health command behavior.
- Add a lightweight regression test that prevents CLI from importing lower-level module contracts or concrete modules directly.
- The boundary test can inspect the CLI source text for forbidden import paths. This is acceptable for WU-01 because the project is still small.

Validation:

- `pnpm test` passes.
- The CLI source imports app/runtime only for current behavior.
- The CLI does not import from sources, storage, processors, embeddings, indexing, or query.

### Task 7: Mark WU-01 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/01-core-contracts-and-module-boundaries.md`

Plan:

- During implementation, move WU-01 status through `implementing` and `testing`.
- After validation passes, mark WU-01 as `[x] Status: passed`.
- Mark all checklist steps in this plan as complete.
- Commit the work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm cli health` still prints the runtime health JSON.
- `git status --short` shows only expected files before commit and is clean after commit.

## Success Check

WU-01 is successful only if:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm cli health` prints `{"name":"mind-weave-core","status":"ok"}`.
- Contract files exist in module-owned directories.
- CLI remains a thin adapter over app/runtime.
- No concrete source, processor, embedding, storage, query, indexing, or MCP implementation is introduced.
- WU-01 status in `04_execution_index.md` is marked as passed after implementation.

## Recovery Notes

If execution is interrupted:

- If only shared/source/processor contracts exist, resume at Task 3.
- If embedding/query contracts exist but storage/indexing contracts do not, resume at Task 4.
- If all contract files exist but app runtime has not been aligned, resume at Task 5.
- If app runtime is aligned but CLI boundary tests are missing, resume at Task 6.
- If validation passed but docs are not marked complete, resume at Task 7.

## Execution Notes

- Contract files were created in module-owned directories.
- Fake implementations live only in tests and do not create concrete runtime adapters.
- `src/interfaces/cli/main.ts` remains a thin adapter over `src/app/runtime.ts`.
- `pnpm cli health` required elevated execution in this sandbox because `tsx` creates an IPC pipe under the system temporary directory.

## Plan Review Checklist

- [x] The plan defines module-owned contract responsibilities.
- [x] The plan avoids full implementation code.
- [x] The plan states non-goals clearly.
- [x] The plan has validation criteria for each task.
- [x] The plan preserves existing WU-00 behavior.
- [x] The plan keeps WU-01 smaller than config/source/storage implementation work.
