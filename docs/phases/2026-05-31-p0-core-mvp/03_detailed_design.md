# P0 Core MVP Detailed Design

This document records the detailed design decisions needed before writing an executable implementation plan.

It is intentionally more concrete than the architecture document, but less detailed than a task-by-task implementation plan.

## 1. Design Goal

P0 should produce a reusable MindWeave Core runtime, not a CLI-centered application.

The lightweight CLI exists only as a development and validation adapter. It must call the same core services that MCP and future product shells call.

The core design should follow this rule:

```text
explicit modules
thin abstractions
single implementation per extension point
code registration
no automatic plugin discovery
```

## 2. Core Boundary

Decision status: `Accepted`

MindWeave Core should not be implemented as one large facade.

Core is a set of composable services owned by modules. The `app` module wires them together and exposes lifecycle wiring for interface adapters.

Recommended runtime shape:

```text
app/
  createRuntime()
  startRuntime()
  stopRuntime()

config/
  loadConfig()
  validateConfig()
  createEffectiveConfig()

sources/
  SourceProvider
  LocalFsSourceProvider
  createSourceProviders()

indexing/
  IndexingService
  InMemoryJobQueue
  DocumentLoader

processors/
  DocumentProcessor
  MarkdownProcessor
  resolveProcessor()

embeddings/
  EmbeddingProvider
  OpenAICompatibleEmbeddingProvider

storage/
  Storage
  SQLiteStorage

query/
  QueryService

interfaces/
  cli/
  mcp/

shared/
  hash
  ids
  logger
  errors
```

`app` should compose dependencies. It should not own source scanning, chunking, embedding, storage, or query logic.

## 3. Adapter Rule

Decision status: `Accepted`

All external surfaces are interface adapters.

Current adapters:

- CLI adapter for development and validation.
- MCP adapter for agent access.

Future adapters:

- Tauri UI bridge.
- HTTP adapter.
- TUI adapter.

Adapters may call core services, but must not bypass them.

Allowed:

```text
CLI -> IndexingService.scanSource()
CLI -> QueryService.search()
MCP -> QueryService.search()
MCP -> Storage.listSources()
Future Tauri -> app/runtime status and config APIs
```

Not allowed:

```text
CLI -> direct SQLite writes
CLI -> direct file scanning
MCP -> direct vector search implementation
Tauri -> direct chunking or embedding
```

## 4. Registration Model

Decision status: `Accepted`

P0 should use explicit code registration.

Configuration selects enabled source types and provider settings. App composition maps those config values to concrete implementations.

Example concept:

```text
source.type = "local-fs"
  -> app creates LocalFsSourceProvider

processor for ".md"
  -> app registers MarkdownProcessor

embedding.provider = "openai-compatible"
  -> app creates OpenAICompatibleEmbeddingProvider

storage.type = "sqlite"
  -> app creates SQLiteStorage
```

P0 should not implement:

- Automatic module discovery.
- Plugin manifests.
- Runtime provider loading.
- Third-party adapter sandboxing.

Rationale:

- The module boundaries are real.
- The number of implementations is small.
- Code registration keeps P0 easy to reason about.
- Future plugin systems can be added after stable contracts exist.

## 5. Configuration Design

Decision status: `Accepted`

P0 needs a config file that is easy to edit and easy to validate.

Recommended direction:

- Use a user config file for human-editable settings.
- Produce an effective config after validation and defaults.
- Store runtime state in SQLite, not in the config file.

Decision:

- Config format is JSONC.
- User config is the source of truth for source definitions.
- Effective config is produced by validation and defaults.
- SQLite mirrors effective source records for status and query metadata.
- Source IDs are user-provided when present.
- If a source ID is omitted, generate it from the normalized absolute root path.
- Generated source IDs may change if the root path changes.
- Users who need stable identity across source moves should set an explicit source ID.
- P0 does not implement config mutation APIs.

Why this is reasonable:

- Config remains inspectable and UI-independent.
- SQLite can still answer status/query metadata questions.
- Future UI can edit the config or call a config service without changing core indexing.

Deferred:

- UI-driven config editing belongs to a later product shell phase.
- A future config service may be introduced when Tauri needs to modify user config safely.

## 6. Runtime and Lifecycle

Decision status: `Accepted`

The core runtime should be a Node.js / TypeScript process.

The runtime should support:

- Load config.
- Initialize storage.
- Initialize embedding provider.
- Initialize source providers.
- Run startup scan.
- Start watchers.
- Start MCP server.
- Stop watchers and close storage on shutdown.

The CLI adapter can expose commands for validation:

```text
mindweave start --config <path>
mindweave scan --config <path>
mindweave status --config <path>
mindweave query --config <path> "<query>"
```

These commands should call app-composed services. They should not implement indexing or query logic directly.

Command behavior:

- `start` is the full runtime command. It runs startup scan, starts watchers, starts the index queue, and starts MCP if enabled.
- MCP is configurable and enabled by default for `start`.
- `scan` is a one-shot indexing command. It scans configured sources, processes indexing jobs, exits after the queue drains, and does not start watchers or MCP.
- `status` is a read-only status command. It opens storage, reports current source/document/index state, and does not start indexing, watchers, or MCP.
- `query` is a read-oriented query command. It initializes QueryService, queries the existing index, and does not trigger indexing.
- CLI remains an adapter and must not implement core logic.

Priority:

- Required for P0 validation: `start`, `scan`.
- Useful but not required for the first implementation slice: `status`, `query`.

## 7. Source Design

Decision status: `Accepted`

The initial source provider is `LocalFsSourceProvider`.

Responsibilities:

- Scan configured local roots.
- Find supported Markdown files.
- Emit source events for add, modify, and delete.
- Produce document candidates with source metadata.

It should not:

- Read content for indexing.
- Compute chunk content hashes.
- Chunk content.
- Embed content.
- Write storage.

Recommended document candidate fields:

- sourceId
- uri
- relativePath
- fileType
- updatedAt
- size

File support:

- Index `.md` files.
- Also accept `.markdown` because the implementation cost is negligible.

Default ignore behavior:

- Ignore hidden files and hidden directories.
- Ignore `.git`.
- Ignore `node_modules`.
- Ignore `dist`.
- Ignore `build`.
- Ignore `.DS_Store`.

User exclude behavior:

- Support a simple list of user-configured exclude regex patterns.
- Do not implement full `.gitignore` compatibility in P0.
- Do not implement a complex include/exclude precedence engine in P0.

Symlink behavior:

- Do not follow symlinks by default.
- Symlink opt-in can be considered later if needed.

Nested source behavior:

- Reject nested sources during config validation.
- If one source root contains another source root, treat it as a configuration error instead of a warning.

## 8. Indexing Design

Decision status: `Accepted`

The indexer is the synchronization center.

Pipeline:

```text
source event or scan result
  -> enqueue job
  -> debounce/coalesce
  -> read current content
  -> compare document fingerprint
  -> skip unchanged document when fingerprint matches
  -> process Markdown
  -> compute chunk content hashes
  -> preserve embeddings for unchanged chunk occurrences
  -> embed missing chunks
  -> replace document chunks
  -> update vector index
  -> update document status
```

Job queue:

- In-memory only.
- Pending jobs for the same document are coalesced.
- Running jobs are not cancelled.
- A new event during a running job creates a follow-up job.
- Failed transient jobs retry with a limit.

Recommended defaults:

- Concurrency: 1 initially.
- Max retries: 3.
- Debounce: 2 seconds.
- Backoff: simple exponential or fixed increasing delay.

Job types:

- `upsert-document`
- `delete-document`

`reindex-source` can be implemented as a higher-level operation that expands into document jobs. It does not need to be a core queue job type in P0.

Coalescing rules:

- Same-document pending `upsert-document` jobs are replaced by the latest one.
- Pending `delete-document` overrides pending `upsert-document`.
- A later `upsert-document` may replace a pending `delete-document` if the file appears again.
- Running jobs are not cancelled.
- If a new event arrives while a job is running, enqueue a follow-up job after the running job completes.

Scan reconciliation:

- A source scan produces the current document snapshot for that source.
- Storage must keep a `documents` table or equivalent document registry.
- The indexer compares the current source snapshot with active documents previously recorded in storage.
- Documents missing from the current snapshot produce `delete-document` jobs.

The document registry is required for stable delete behavior. Without a stored list of known documents, startup scan cannot reliably detect files that were deleted while the process was not running.

The `documents` table is required in P0. It is not optional metadata. It supports:

- Delete reconciliation when files are removed while MindWeave is not running.
- Index skipping through stored document fingerprint.
- Incremental embedding preservation for unchanged chunk occurrences.
- Document-level status such as `indexed`, `stale`, `failed`, and `deleted`.
- Document-level chunk replacement when a source file changes.
- Future non-file sources where a Document may represent a database row, saved event, exported message, email, or saved web page.

The minimum useful document state should include:

- document ID
- source ID
- URI or path
- relative path when available
- file type
- status
- lightweight fingerprint such as mtime and size
- source updated time
- indexed time
- deleted time when applicable
- last error when applicable

Recommended document statuses:

- `indexed`
- `stale`
- `failed`
- `deleted`

`discovered` does not need to be persisted unless implementation proves it useful. It can remain an in-memory indexing state.

Delete behavior:

- Mark the document as deleted.
- Mark its chunks as deleted.
- Query excludes deleted documents and chunks by default.
- Physical deletion can be handled later through cleanup.

Failure behavior:

- If a document has never been successfully indexed and indexing fails, mark it `failed`.
- If a document was previously indexed and a later update fails, keep the previous indexed chunks and mark the document `stale`.
- Job failures are retried up to the configured retry limit.
- Unsupported file, parse, or config errors should not retry endlessly.

## 9. Markdown Processing

Decision status: `Accepted`

Markdown processing should treat Markdown as structured natural-language text.

Recommended behavior:

- Use Markdown headings and paragraph structure as natural-language boundaries.
- Include heading context directly in chunk text when available.
- Split oversized sections by size.
- Add small overlap between adjacent chunks.
- Ignore graph-like Markdown relationships in P0.

Recommended defaults:

- Store one primary chunk text field.
- Use the same chunk text for embedding and query results.
- Do not require a separate chunk title or heading path field in P0.
- Chunk text should stay close to source content.
- When a chunk belongs under headings, include those headings as part of the chunk text.
- Raw frontmatter is not emitted as a normal content chunk.

Out of scope for P0:

- Obsidian tag graph.
- Backlinks.
- Wikilink resolution.
- Markdown hyperlink relationship modeling.
- Table-specific semantic extraction.
- Graph-based retrieval.

Chunk sizing:

- Split oversized sections by character length.
- Default `maxChunkChars`: 3000.
- Default `overlapChars`: 300.
- Apply overlap only within oversized sections, not across different heading sections.

Implementation direction:

- Do not implement a full Markdown chunker from scratch unless existing libraries prove unsuitable.
- Use a selected TypeScript Markdown/RAG splitter behind the `DocumentProcessor` interface.
- Keep external splitter types out of indexing, storage, and query modules.
- Normalize splitter output into MindWeave-owned Chunk objects.
- Keep the chunking library replaceable through a small adapter layer.
- Do not introduce LLM-based semantic chunking in P0.
- Do not require an exact tokenizer in P0.

Candidate libraries to evaluate:

- `@langchain/textsplitters` `MarkdownTextSplitter`
- `llm-text-splitter`
- LlamaIndex.TS `MarkdownNodeParser`

Selection criteria:

- Markdown heading behavior.
- Dependency weight.
- ESM/CJS compatibility.
- Ability to configure chunk size and overlap.
- Predictable output for tests.
- Minimal coupling to a larger framework data model.

Implementation verification:

- Which Markdown/RAG splitter should be selected after a small spike?
- Should frontmatter be ignored entirely or only stripped from chunk text?

## 10. Identity Rules

Decision status: `Accepted`

Identity should be stable enough for local indexing without making rename detection complex.

Recommended rules:

```text
sourceId = user-provided id or generated id
documentId = hash(sourceId + normalizedRelativePath)
documentFingerprint = { mtimeMs, size }
chunkContentHash = hash(normalized chunk.text)
chunkId = hash(documentId + chunkIndex + chunkContentHash)
```

Move/rename behavior:

- Treat move as delete plus add.
- Preserve embeddings only for unchanged chunk occurrences in the same document when the embedding configuration is unchanged.

Document fingerprint:

- P0 should use file metadata as the first document-level change detector.
- If stored `mtimeMs` and `size` match the current file metadata, indexing can skip reading the file.
- A full document content hash is not required in P0.
- A nullable document content hash may be added later for strict verification, debugging, or unreliable filesystems.
- P0 assumes modern local filesystems provide sufficiently reliable `mtimeMs` and `size` metadata for personal knowledge indexing.
- The edge case where content changes without changing `mtimeMs` or `size` is accepted in P0.

Chunk content hash:

- `chunkContentHash` is the source-derived chunk content fingerprint.
- It exists to detect whether a chunk occurrence changed when only part of a document changes.
- It should be computed from normalized `chunk.text`.
- Because chunk text includes heading context when available, heading changes affect the relevant chunk hash.
- `chunkContentHash` is not a global embedding cache key.
- P0 uses `chunkContentHash` only after the comparison is scoped to the same document.
- The comparison scope for preserving an existing chunk embedding is `documentId`, `chunkIndex`, `chunkContentHash`, provider, model, and dimensions.
- Identical chunk text in different documents does not share embeddings in P0.

Embedding ownership:

- Embeddings belong to chunk occurrences.
- P0 should keep the mapping `document -> chunk -> embedding`.
- Different chunk occurrences should not share one embedding record, even if their text is identical.
- This avoids global embedding reference counting, shared lifecycle management, and complicated cleanup behavior.
- Embeddings may be preserved for the same chunk occurrence only when `chunkId`, `chunkContentHash`, provider, model, and dimensions still match the active embedding configuration.
- Each embedding record should explicitly store provider, model, and dimensions.
- Changing provider, model, dimensions, or chunking strategy requires reindexing.
- P0 does not need a separate public `embeddingCacheKey` concept.

Chunk identity:

- `chunkId` represents a chunk occurrence inside a document, not only its text content.
- Include `documentId` and `chunkIndex` so repeated identical chunks remain distinct query results.

## 11. Storage Design

Decision status: `Accepted`

The initial storage adapter should use SQLite with sqlite-vec.

Storage should expose domain operations rather than raw SQL to other modules.

Node integration:

- Use `better-sqlite3` as the first SQLite binding.
- Use the official `sqlite-vec` npm package.
- Load sqlite-vec through `sqliteVec.load(db)`.
- Keep sqlite-vec loading inside `SQLiteStorage`.
- If future Tauri packaging changes native module constraints, revisit this choice during the product shell phase.

Recommended storage areas:

- sources
- documents
- chunks
- embeddings
- vector rows
- schema marker
- index configuration
- job/document status

P0 can implement this through one `SQLiteStorage` class or a small set of internal helpers. It does not need many repository classes at first.

Ownership model:

```text
sources
  -> documents
    -> chunks
      -> embeddings
        -> vec_embeddings
```

- `sources` is a runtime mirror of effective config, not the source of truth.
- User config owns source definitions.
- SQLite mirrors effective sources for query and status.
- The source mirror is rebuildable.
- `documents` is the persistent document registry required for delete reconciliation.
- `chunks` belong to documents.
- `embeddings` belong to chunk occurrences.
- `vec_embeddings` belong to embeddings.
- Different chunk occurrences do not share embeddings, even if text is identical.

Minimum table set:

- `sources`
- `documents`
- `chunks`
- `embeddings`
- `vec_embeddings`
- `meta` or equivalent schema marker
- `index_config`

Exact schema direction:

- Use normal SQLite tables for `sources`, `documents`, `chunks`, `embeddings`, `meta`, and `index_config`.
- Use a sqlite-vec `vec0` virtual table for `vec_embeddings`.
- `embeddings` stores provider/model/dimensions and chunk ownership metadata.
- `vec_embeddings` stores vectors and a logical `embedding_id` parent link.
- Table-level foreign keys are useful where SQLite supports them, but P0 relies on business constraints plus maintenance for sqlite-vec virtual table relationships.

Vector table relationship:

- `vec_embeddings.embedding_id` is the logical parent link to `embeddings.id`.
- If sqlite-vec cannot enforce foreign keys directly, `SQLiteStorage` must enforce the relationship at write and cleanup time.

Query safety:

- Query results must be produced by joining vector rows back through `embeddings -> chunks -> documents -> sources`.
- Query must exclude deleted chunks and deleted documents by default.
- Query must exclude failed documents by default.
- `stale` documents may remain queryable, but results should expose document status.
- Orphan vector rows must not appear in query results because they cannot join back to an active parent chain.
- Source filters, file type filters, status filters, score threshold, and limit should be expressed by `SQLiteStorage` using SQL.
- QueryService should not apply these filters after retrieving rows.
- If sqlite-vec cannot apply every filter before KNN internally, `SQLiteStorage` may use SQL joins/CTEs and overfetching as an implementation detail.
- JavaScript-side filtering should be avoided unless a sqlite-vec limitation makes SQL filtering impractical.

Vector search:

- Use `vec0` KNN search.
- Use cosine distance as the initial distance metric.
- Store one vector row per embedding.
- Use `k = <limit or candidate limit>` style KNN queries where supported.
- Public score is derived from raw distance by `SQLiteStorage`.
- Initial score normalization should use `score = 1 / (1 + distance)` unless implementation testing proves a better cosine-specific mapping.

Write safety:

- Document replacement should be transactional where possible.
- Replacement should update document state, chunks, embeddings, vector rows, and deleted old chunks as one storage operation.
- Transactions prevent most inconsistencies.
- Storage maintenance exists as a second line of defense.

Index configuration changes:

- P0 does not support in-place index config migration.
- If provider, model, dimensions, or chunking strategy differs from the stored active index config, runtime should refuse to use the existing index.
- The user must either restore the previous config or reset the index.
- `reset-index` clears derived runtime/index rows and rebuilds from config.
- Resetting index should clear `sources`, `documents`, `chunks`, `embeddings`, `vec_embeddings`, and `index_config`.
- Resetting index should keep the schema marker.
- After reset, sources are rebuilt from effective config and scanning starts from scratch.

Schema marker:

- P0 does not implement a migration framework.
- Storage should keep a minimal schema marker, such as `schema_version`.
- If the schema marker is incompatible, runtime should fail with an instruction to reset or recreate the local database.
- Early development can tolerate database reset instead of migration.

Maintenance:

- P0 does not run scheduled maintenance.
- Maintenance should be manually triggered.
- Default maintenance behavior should be check-only.
- Cleanup must be explicit.
- Maintenance should check parent-child integrity across sources, documents, chunks, embeddings, and vector rows.
- Cleanup should only remove or mark unambiguous orphan rows.

Deferred implementation choices:

- Exact table columns and indexes.
- Exact reset-index command shape.
- Exact maintenance command shape.
- Whether sqlite-vec metadata or partition columns are needed for efficient filtered KNN.
- Whether overfetching is needed when SQL filters cannot be pushed into the KNN step.

## 12. Embedding Design

Decision status: `Accepted`

The first embedding adapter should be OpenAI-compatible.

Configuration:

- `provider`: `openai-compatible`
- `model`
- `baseUrl`
- `apiKeyEnv`
- `dimensions` when needed
- `batchSize`

Behavior:

- Batch chunk embedding.
- Embed queries using the same active configuration.
- Retry transient provider failures.
- Mark model/provider changes through index configuration hash.
- API keys are referenced through environment variable names.
- `dimensions` is optional and sent only when configured.
- Default `batchSize` is 64.
- Transient provider errors are retried up to 3 times.
- Auth, config, and invalid request errors are not retried endlessly.
- Query embedding failure is returned as an adapter error.
- Document embedding failure is handled by IndexingService status rules.
- Each embedding record belongs to one chunk and stores provider, model, and dimensions.
- Index config changes require `reset-index` or restoring the previous config.

Out of scope for P0:

- Multiple active embedding providers.
- Provider-specific SDK integrations.
- Keychain or secret manager support.
- Reranking.
- Dynamic model switching without reset.

## 13. Query Design

Decision status: `Accepted`

QueryService should be protocol-independent.

Input:

- query text
- limit
- include source IDs
- exclude source IDs
- file type filter
- score threshold

Output:

- chunk text
- normalized score
- chunk ID
- document ID
- source ID
- source name
- path or URI
- source updated time
- indexed time
- metadata

Filtering responsibility:

- QueryService validates query options and embeds the query.
- QueryService must not implement result filtering in application code.
- Storage is responsible for applying source, file type, status, score threshold, and limit filters through SQL.
- Storage should avoid querying a small top-K vector set and then filtering it in JavaScript.
- If sqlite-vec requires metadata columns for efficient filtered KNN, `SQLiteStorage` may denormalize minimal filter fields into the vector table.
- Any denormalized vector metadata is an implementation detail and must be maintained from source, document, and chunk state.

Defaults:

- Default `limit`: 8.
- Maximum `limit`: 50.
- Default `scoreThreshold`: unset.
- `indexed` documents are queryable by default.
- `stale` documents are queryable by default, but result metadata must expose document status.
- `failed` documents are excluded by default.
- `deleted` documents and chunks are excluded by default.
- `disabled` sources are excluded by default.
- Source `error` status does not automatically hide already indexed chunks, but result metadata must expose source status.

Score:

- Public score is normalized to `0..1`.
- Higher score means more relevant.
- The storage adapter is responsible for converting raw vector distance into normalized score.
- The exact normalization formula depends on the selected sqlite-vec distance metric.

QueryResult should include:

- `chunkId`
- `documentId`
- `sourceId`
- `sourceName`
- `path` or URI
- `text`
- `score`
- `documentStatus`
- `sourceStatus`
- `sourceUpdatedAt`
- `indexedAt`

Out of scope for P0:

- Reranking.
- Hybrid search.
- Query expansion.
- Relevance explanation.
- Generated summaries.
- Result grouping.
- Debug score explanations.

## 14. MCP Interface

Decision status: `Accepted`

MCP should be an interface adapter over QueryService and storage read operations.

Baseline tool:

```text
search_knowledge
list_sources
```

Later useful tools:

```text
get_chunk
```

Recommended P0 behavior:

- Implement `search_knowledge`.
- Implement `list_sources`.
- Defer `get_chunk` unless search results need compact payloads.

`search_knowledge` input:

- `query`: required string.
- `limit`: optional number.
- `includeSourceIds`: optional string array.
- `excludeSourceIds`: optional string array.
- `fileTypes`: optional string array.
- `scoreThreshold`: optional number from `0..1`.

`search_knowledge` behavior:

- Returns full chunk text by default.
- Allows `includeSourceIds` and `excludeSourceIds` to be used together.
- Applies include source filtering before exclude source filtering.
- Returns empty results when filters produce an empty candidate set.
- Returns tool errors for runtime/query failures.
- Empty results mean the query executed successfully with no matches.

`search_knowledge` output:

- `results`
- `chunkId`
- `documentId`
- `sourceId`
- `sourceName`
- `path` or URI
- `text`
- `score`
- `documentStatus`
- `sourceStatus`
- `sourceUpdatedAt`
- `indexedAt`

`list_sources` input:

- No required input.

`list_sources` output:

- `sourceId`
- `name`
- `type`
- `rootUri`
- `status`
- `lastScannedAt`
- `lastError`

Deferred:

- `get_chunk`
- `get_document`
- `reindex_source`
- `open_file`
- `query_debug`
- `explain_score`

## 15. Testing Strategy

Decision status: `Accepted`

Testing should match the modular design.

Recommended test layers:

- Unit tests for config validation, ID/hash helpers, chunking, and query option normalization.
- Integration tests for LocalFsSourceProvider using temporary fixture directories.
- Integration tests for SQLiteStorage using temporary databases.
- Integration tests for IndexingService with mocked embedding provider.
- End-to-end test for local Markdown folder -> index -> query.

Recommended test framework:

- Use Vitest unless there is a strong reason to prefer Node's built-in test runner.

Decisions:

- Use Vitest.
- Use a `FakeEmbeddingProvider` for deterministic tests.
- Normal tests must not call external embedding APIs.
- Provider-dependent tests should be separate manual or integration tests.
- sqlite-vec tests may be isolated as integration tests if native extension setup is fragile.
- End-to-end tests should use fixture Markdown files and fake embeddings.
- Watcher tests should focus on event handling and job coalescing rather than relying only on real filesystem events.
- MCP tests can target adapter handlers before full protocol integration.

Out of scope for P0 test baseline:

- Real provider API tests in the normal suite.
- Tauri tests.
- Large corpus performance tests.
- Full MCP protocol integration as a blocker for initial implementation.

## 16. Check Sequence

Review and close these items before writing the executable implementation plan:

- [x] Core module boundary and adapter rule.
- [x] Explicit code registration, no automatic discovery.
- [x] Config format and source ID rule.
- [x] Runtime lifecycle and CLI validation commands.
- [x] Local filesystem defaults and ignore behavior.
- [x] Index queue behavior, retries, and delete detection.
- [x] Markdown processing boundary, chunk size, overlap, and library adapter rule.
- [x] Document ID, chunk ID, document fingerprint, chunk content hash, and embedding preservation rules.
- [x] Storage ownership model, reset-index behavior, maintenance direction, and schema marker approach.
- [x] SQLite binding, sqlite-vec loading, distance metric, and schema direction.
- [x] Embedding config, batch size, retry, and API key handling.
- [x] Query defaults, SQL filtering responsibility, and score normalization contract.
- [x] MCP tool set and schemas.
- [x] Testing framework and deterministic test strategy.

After these are checked, use the writing-plans workflow to turn the design into a task-by-task implementation plan.
