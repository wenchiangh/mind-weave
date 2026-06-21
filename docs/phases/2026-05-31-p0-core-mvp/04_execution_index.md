# P0 Core MVP Execution Index

This document tracks P0 execution as a sequence of small, interruptible work units.

Each work unit should produce a small observable result, have targeted validation, and leave the repository in a clean state when complete.

## Status Model

Checkbox state tracks final completion:

- `[ ]`: not fully complete.
- `[x]`: implemented, validated, committed, and accepted for this work unit.

Status tags track current phase:

- `planned`: scope is listed here, but no detailed executable plan exists yet.
- `plan-ready`: detailed executable plan exists and can be executed.
- `implementing`: code is being changed for the work unit.
- `implemented`: code changes are complete, but validation is not complete.
- `testing`: validation is running or failures are being fixed.
- `passed`: implementation and validation are complete.
- `blocked`: progress requires a decision, dependency, or design correction.
- `deferred`: intentionally postponed.

## Execution Rules

- Execute one work unit at a time.
- Before implementation, the target work unit must have status `plan-ready`.
- Update this index when a work unit moves between planning, implementation, testing, and passed states.
- Keep detailed task steps inside `work-units/*.md`.
- Keep tests with the work unit plan instead of creating a separate test plan document.
- Commit after each completed work unit unless the user asks otherwise.

## Work Units

## WU-00 Project Skeleton and Tooling

- [x] Status: `passed`
- Plan: `work-units/00-project-skeleton-and-tooling.md`
- Depends on: none
- Design refs:
  - `03_detailed_design.md#1-design-goal`
  - `03_detailed_design.md#2-core-boundary`
  - `03_detailed_design.md#15-testing-strategy`
- Scope:
  - Create the TypeScript project skeleton.
  - Add pnpm-based test and typecheck tooling.
  - Use TypeScript 7 beta native preview for typechecking.
  - Add a minimal runtime stub and CLI adapter stub.
  - Do not implement config, source scanning, storage, embeddings, query, or MCP.
- Observable result:
  - A clean checkout can install dependencies with pnpm, run typecheck, run tests, and execute a minimal CLI health command without any external service.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - CLI health command prints a stable JSON payload.
- Notes:
  - WU-00 intentionally starts on TypeScript 7 beta native preview because P0 begins close to the TypeScript 7 stable release window.
  - Replace the preview package with the stable TypeScript package after TypeScript 7 reaches stable release.
  - This work unit establishes the development foundation only. Domain contracts come next.
- Completion criteria:
  - Detailed plan exists.
  - Implementation committed.
  - Targeted validation passes.
  - Status updated to `passed`.

## WU-01 Core Contracts and Module Boundaries

- [x] Status: `passed`
- Plan: `work-units/01-core-contracts-and-module-boundaries.md`
- Depends on: WU-00
- Design refs:
  - `03_detailed_design.md#2-core-boundary`
  - `03_detailed_design.md#3-adapter-rule`
  - `03_detailed_design.md#4-registration-model`
- Scope:
  - Define core-owned TypeScript contracts for source candidates, documents, chunks, embeddings, storage operations, query input/output, and runtime composition.
  - Keep contracts small and owned by their modules.
  - Do not implement concrete adapters beyond minimal test doubles.
- Observable result:
  - Core modules compile with explicit interfaces, and interface adapters have no direct storage, scanning, chunking, embedding, or vector search logic.
- Validation summary:
  - Type-level tests or unit tests verify expected contract shapes where behavior exists.
  - Static imports show adapters depend on core services, not concrete internals.
- Completion criteria:
  - Contracts exist in module-owned files.
  - Module boundaries match the detailed design.
  - Typecheck and tests pass.

## WU-02 Config Loading and Effective Config

- [x] Status: `passed`
- Plan: `work-units/02-config-loading-and-effective-config.md`
- Depends on: WU-01
- Design refs:
  - `03_detailed_design.md#5-configuration-design`
  - `03_detailed_design.md#7-source-design`
- Scope:
  - Load JSONC user config.
  - Validate required fields.
  - Produce effective config with defaults.
  - Generate source IDs from normalized absolute root paths when omitted.
  - Reject nested local filesystem sources.
- Observable result:
  - Given a config file, Core can produce a deterministic effective config or a clear validation error without starting indexing.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Config integration tests prove a real JSONC config file can be loaded into deterministic effective config without starting indexing.
  - Config integration tests prove invalid config files return structured errors.
  - Unit tests cover valid config, missing fields, generated IDs, explicit IDs, nested source rejection, exclude regex validation, JSONC parsing, and config module boundary rules.
  - `pnpm cli health` remains a regression check for the existing CLI stub, not the primary WU-02 acceptance test.
- Completion criteria:
  - Config loading is UI-independent.
  - Runtime state is not written to user config.
  - Typecheck and tests pass.

## WU-03 Runtime Composition and CLI Shell

- [x] Status: `passed`
- Plan: `work-units/03-runtime-composition-and-cli-shell.md`
- Depends on: WU-02
- Design refs:
  - `03_detailed_design.md#4-registration-model`
  - `03_detailed_design.md#6-runtime-and-lifecycle`
- Scope:
  - Add app composition for config, logger, and minimal service registration.
  - Add CLI command routing for `start`, `scan`, `status`, and `query` as adapter calls.
  - Implement only commands that can safely return not-yet-available capability errors where downstream services are not built.
- Observable result:
  - CLI can load config and route commands through the app/runtime layer without owning core logic.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Runtime tests use a real JSONC config file to prove app/runtime composition.
  - CLI tests verify `status --config <path>` reaches runtime-composed status.
  - CLI tests verify `start`, `scan`, and `query` route through runtime and return structured capability-not-available errors until downstream services exist.
  - CLI boundary tests prove the adapter does not import config or downstream concrete modules directly.
- Completion criteria:
  - CLI remains a thin adapter.
  - Runtime lifecycle can start and stop with the currently available services.
  - Typecheck and tests pass.

## WU-04 Local FS Source Discovery

- [x] Status: `passed`
- Plan: `work-units/04-local-fs-source-discovery.md`
- Depends on: WU-02
- Design refs:
  - `03_detailed_design.md#7-source-design`
- Scope:
  - Implement local filesystem source scanning for Markdown files.
  - Return document candidates only.
  - Do not read file content, chunk, embed, or write storage.
- Observable result:
  - A configured local source folder can be scanned and returns deterministic document candidates with source ID, URI, relative path, file type, updated time, and size.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Fixture directory integration tests cover `.md`, `.markdown`, hidden paths, ignored directories, non-Markdown files, exclude regex patterns, and symlink behavior.
  - Source boundary tests prove the provider does not import config, app, CLI, storage, indexing, processors, embeddings, or query modules.
  - CLI `scan --config <path>` remains a structured capability-not-available response until later runtime/indexing wiring exists.
- Completion criteria:
  - SourceProvider responsibilities match detailed design.
  - Nested source rejection remains in config validation.
  - Typecheck and tests pass.

## WU-05 Identity and Document Fingerprint

- [x] Status: `passed`
- Plan: `work-units/05-identity-and-document-fingerprint.md`
- Depends on: WU-02, WU-04
- Design refs:
  - `03_detailed_design.md#10-identity-rules`
- Scope:
  - Implement source ID, document ID, document fingerprint, chunk content hash, and chunk ID helpers.
  - Keep document fingerprint based on `mtimeMs` and size.
  - Avoid full document content hashing.
- Observable result:
  - Given stable source IDs, relative paths, file metadata, and chunk text, Core can produce deterministic IDs and fingerprints.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Unit tests cover path normalization, generated source IDs, document IDs, document fingerprints, chunk content hashes, chunk IDs, same-document chunk preservation scope, and rename as delete plus add.
  - Config source ID generation uses the shared identity helper.
- Completion criteria:
  - Identity helpers are reusable by config, source, processor, indexing, and storage modules.
  - Typecheck and tests pass.

## WU-06 Markdown Processing

- [x] Status: `passed`
- Plan: `work-units/06-markdown-processing.md`
- Depends on: WU-01, WU-05
- Design refs:
  - `03_detailed_design.md#9-markdown-processing`
- Scope:
  - Select and wrap a TypeScript Markdown/RAG splitter.
  - Implement MarkdownProcessor behind the DocumentProcessor interface.
  - Include heading context in chunk text.
  - Compute chunk content hashes for processor output.
- Observable result:
  - A Markdown document can be converted into stable chunk objects whose text is suitable for embedding and direct query result return.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Processor acceptance test proves a realistic Markdown document becomes storage-ready chunks with document/source traceability, index, text, content hash, and chunk ID.
  - Tests cover heading sections, paragraphs, oversized sections, overlap within oversized sections, frontmatter handling, chunk identity, and deterministic output.
  - Processor boundary tests prove Markdown processing does not import config, app, CLI, storage, indexing, embeddings, or query modules.
- Completion criteria:
  - External splitter types do not leak outside the processor module.
  - Typecheck and tests pass.

## WU-07 SQLite Metadata Storage

- [x] Status: `passed`
- Plan: `work-units/07-sqlite-metadata-storage.md`
- Depends on: WU-01, WU-05
- Design refs:
  - `03_detailed_design.md#11-storage-design`
- Scope:
  - Implement SQLite schema marker, index configuration record, sources, documents, chunks, and embeddings metadata tables.
  - Do not implement sqlite-vec vector search in this work unit.
  - Implement soft delete and parent-chain metadata writes where vector rows are not involved.
- Observable result:
  - Storage can create/open a database, persist effective sources, upsert documents, replace chunks and embedding metadata, mark deletes, and list source/document status.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Temporary database integration tests cover schema creation, compatible reopen, incompatible schema marker failure, source mirror rebuild, document registry, soft delete exclusion from active listing, chunk replacement, embedding metadata replacement, and index config roundtrip.
  - Storage boundary tests prove the storage module does not import config, app, CLI, source provider implementation, processors, indexing, embeddings, or query modules.
- Completion criteria:
  - Storage exposes domain operations instead of raw SQL to other modules.
  - Typecheck and tests pass.

## WU-08 sqlite-vec Vector Storage Spike

- [x] Status: `passed`
- Plan: `work-units/08-sqlite-vec-vector-storage-spike.md`
- Depends on: WU-07
- Design refs:
  - `03_detailed_design.md#11-storage-design`
  - `03_detailed_design.md#13-query-design`
- Scope:
  - Validate `better-sqlite3` plus official `sqlite-vec` loading.
  - Add `vec_embeddings` virtual table.
  - Prove vector insert and KNN search.
  - Explore filtered KNN shape and whether SQL overfetch or denormalized vector metadata is needed.
- Observable result:
  - A temporary SQLite database can store vectors and return nearest rows joined back to metadata with normalized scores.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Integration tests cover sqlite-vec load, vector insert, KNN query, metadata join, deleted/failed/disabled row exclusion, source filter behavior, file type filter behavior, score threshold behavior, vector replacement cleanup, and score normalization.
  - Spike findings are recorded in the work-unit plan.
- Completion criteria:
  - A clear implementation decision is recorded in the work unit plan or follow-up docs.
  - Typecheck and relevant tests pass.

## WU-09 Embedding Provider

- [x] Status: `passed`
- Plan: `work-units/09-embedding-provider.md`
- Depends on: WU-01
- Design refs:
  - `03_detailed_design.md#12-embedding-design`
  - `03_detailed_design.md#15-testing-strategy`
- Scope:
  - Implement OpenAI-compatible embedding provider.
  - Add deterministic FakeEmbeddingProvider for tests.
  - Support batch size, API key environment lookup, optional dimensions, and retry classification.
- Observable result:
  - Core can embed document chunks and query text through a provider interface, with normal tests using fake embeddings and no external API calls.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Unit tests cover request payloads, batching, query embedding, dimensions omission/inclusion, missing API key errors, retryable failures, non-retryable failures, and fake embedding determinism.
  - Normal tests use mock fetch/fake provider and do not call real embedding APIs.
  - Embedding boundary tests prove the module does not import config, app, CLI, storage, indexing, processors, sources, or query modules.
- Completion criteria:
  - Real provider tests are isolated from normal test suite.
  - Typecheck and normal tests pass without network access.

## WU-10 Index Job Queue

- [x] Status: `passed`
- Plan: `work-units/10-index-job-queue.md`
- Depends on: WU-01, WU-05
- Design refs:
  - `03_detailed_design.md#8-indexing-design`
- Scope:
  - Implement in-memory queue primitives for `upsert-document` and `delete-document`.
  - Implement debounce, coalescing, concurrency 1, retry limit, and follow-up jobs after running jobs.
  - Do not implement full document processing or storage writes.
- Observable result:
  - IndexingService can accept noisy document events and emit a deterministic job execution sequence.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Unit tests cover same-document upsert replacement, delete overriding upsert, later upsert replacing pending delete, FIFO order for different documents, running job follow-up, retry limit, permanent failure behavior, drain behavior, and debounce timing with fake timers.
  - Indexing boundary tests prove the queue does not import config, app, CLI, source provider implementation, processors, embeddings, storage, or query modules.
- Completion criteria:
  - Queue behavior is independent from filesystem and storage.
  - Typecheck and tests pass.

## WU-11 Indexing Document Upsert Flow

- [x] Status: `passed`
- Plan: `work-units/11-indexing-document-upsert-flow.md`
- Depends on: WU-04, WU-06, WU-07, WU-08, WU-09, WU-10
- Design refs:
  - `03_detailed_design.md#8-indexing-design`
  - `03_detailed_design.md#10-identity-rules`
  - `03_detailed_design.md#11-storage-design`
- Scope:
  - Implement the upsert pipeline from document candidate to persisted chunks, embeddings, and vector rows.
  - Skip unchanged documents by fingerprint.
  - Preserve embeddings for unchanged chunk occurrences in the same document and active embedding config.
- Observable result:
  - A Markdown file candidate can be indexed into SQLite/sqlite-vec, re-indexing unchanged files skips work, and changing one section only embeds changed chunk occurrences.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Integration tests with FakeEmbeddingProvider cover first index, unchanged skip, partial document change, stale-on-update-failure, and failed first index.
  - Storage tests cover vector row preservation for unchanged replacement embeddings.
- Completion criteria:
  - Upsert flow writes through storage domain operations.
  - Typecheck and tests pass.

## WU-12 Delete Reconciliation and Soft Delete

- [x] Status: `passed`
- Plan: `work-units/12-delete-reconciliation-and-soft-delete.md`
- Depends on: WU-04, WU-07, WU-10, WU-11
- Design refs:
  - `03_detailed_design.md#8-indexing-design`
  - `03_detailed_design.md#11-storage-design`
- Scope:
  - Compare source scan snapshots against active stored documents.
  - Emit delete jobs for missing documents.
  - Mark documents and chunks deleted.
  - Ensure queries cannot return deleted rows through normal joins.
- Observable result:
  - Removing a Markdown file from a configured source eventually removes its chunks from default query results while preserving traceable deleted metadata.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - Integration tests cover startup-style scan reconciliation, queue-executed delete jobs, and deleted row exclusion from vector search.
  - Existing queue tests cover delete overriding pending upsert and later upsert replacing pending delete.
- Completion criteria:
  - Startup scan can reconstruct delete work.
  - Typecheck and tests pass.

## WU-13 Query Service

- [x] Status: `passed`
- Plan: `work-units/13-query-service.md`
- Depends on: WU-08, WU-09, WU-11, WU-12
- Design refs:
  - `03_detailed_design.md#13-query-design`
- Scope:
  - Implement protocol-independent QueryService.
  - Validate query options.
  - Embed query text with active embedding provider.
  - Delegate source, file type, status, score threshold, and limit filters to storage SQL.
- Observable result:
  - Given an indexed fixture database, QueryService returns ordered chunk results with normalized scores and traceability metadata.
- Validation summary:
  - `pnpm typecheck` passes.
  - `pnpm test` passes.
  - QueryService tests cover default limit, max limit validation, include/exclude source filters, file type filters, score threshold forwarding, provider errors, and SQLite integration.
  - SQLite storage tests cover stale document visibility, failed/deleted exclusion, disabled source exclusion, source filters, file type filters, and score threshold behavior.
- Completion criteria:
  - QueryService does not post-filter result sets in application code.
  - Typecheck and tests pass.

## WU-14 MCP Search and Source Tools

- [ ] Status: `planned`
- Plan: `work-units/14-mcp-search-and-source-tools.md`
- Depends on: WU-13
- Design refs:
  - `03_detailed_design.md#14-mcp-interface`
- Scope:
  - Implement MCP adapter tools `search_knowledge` and `list_sources`.
  - Map tool inputs to QueryService and storage read operations.
  - Do not add reasoning, summaries, or relevance explanations.
- Observable result:
  - An MCP client can call `search_knowledge` and receive full chunk text, normalized score, source/document metadata, and empty results for successful no-match queries.
- Validation summary:
  - Adapter tests cover input schema, output schema, include/exclude source behavior, empty result behavior, tool error behavior, and `list_sources` output.
- Completion criteria:
  - MCP adapter does not access SQLite directly except through approved storage read service boundaries.
  - Typecheck and tests pass.

## WU-15 File Watcher Integration

- [ ] Status: `planned`
- Plan: `work-units/15-file-watcher-integration.md`
- Depends on: WU-04, WU-10, WU-11, WU-12
- Design refs:
  - `03_detailed_design.md#7-source-design`
  - `03_detailed_design.md#8-indexing-design`
- Scope:
  - Add filesystem watcher integration for local sources.
  - Normalize file events into upsert/delete jobs.
  - Apply debounce and coalescing through IndexingService.
  - Keep startup scan as the reconciliation mechanism.
- Observable result:
  - While the runtime is running, creating, editing, and deleting Markdown files triggers eventual index updates.
- Validation summary:
  - Tests focus on event normalization and queue behavior with controlled watcher fakes; a small integration test may cover real filesystem events if stable.
- Completion criteria:
  - Watcher failures are logged or surfaced in status.
  - Typecheck and tests pass.

## WU-16 End-to-End Validation and Hardening

- [ ] Status: `planned`
- Plan: `work-units/16-end-to-end-validation-and-hardening.md`
- Depends on: WU-03 through WU-15
- Design refs:
  - `00_spec.md#acceptance-criteria`
  - `03_detailed_design.md#15-testing-strategy`
- Scope:
  - Validate the full P0 loop from config to source scan, indexing, query, MCP, and file updates.
  - Add missing logs and failure visibility needed for practical use.
  - Keep Tauri and human query playground out of scope.
- Observable result:
  - A user can configure local Markdown folders, run MindWeave Core, index files, query chunks through MCP, and observe file changes converging into the index.
- Validation summary:
  - End-to-end tests cover initial scan, query result traceability, file edit update, file delete removal, failed provider behavior with fake/provider controls, and log visibility.
- Completion criteria:
  - P0 acceptance criteria pass.
  - Work unit statuses are updated.
  - Remaining gaps are documented as follow-up phase work.
