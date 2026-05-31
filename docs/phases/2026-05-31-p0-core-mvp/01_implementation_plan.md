# P0 Core MVP Implementation Outline

This document is an implementation outline for the P0 Core MVP phase. It is not yet a step-by-step execution plan. A detailed executable plan can be created after the phase spec and architecture are approved.

## Phase 1: Core Runtime Skeleton

Build the minimal TypeScript runtime.

Expected result:

- Runtime starts from a terminal.
- Config file can be loaded.
- Effective config can be derived.
- Logger is initialized.
- Runtime lifecycle has start and stop hooks.

Implementation direction:

- Create an `app` module that wires dependencies.
- Keep configuration parsing separate from runtime startup.
- Use simple file logs first.
- Avoid UI dependencies.

## Phase 2: Local Markdown Discovery

Implement local filesystem source scanning.

Expected result:

- Configured source roots are scanned.
- Markdown files are discovered.
- Basic document candidates are produced.
- Nested source conflicts can be detected.

Implementation direction:

- Define SourceProvider and SourceCandidate types.
- Implement LocalFsSourceProvider.
- Use normalized relative paths for document identity inputs.
- Keep file reading out of SourceProvider.

## Phase 3: Markdown Processing

Implement document loading and Markdown chunking.

Expected result:

- Markdown content can be read by the indexer.
- Content hash is computed.
- Heading-aware chunks are produced.
- Chunk hash and metadata are generated.

Implementation direction:

- Put document loading in indexing or a focused loader helper.
- Use a mature Markdown parsing or splitting library if it reduces complexity.
- Preserve heading path.
- Split oversized sections by length.
- Keep chunk output independent from storage.

## Phase 4: SQLite Metadata Store

Persist sources, documents, chunks, and status.

Expected result:

- Sources can be saved and listed.
- Documents can be upserted.
- Chunks can be replaced by document.
- Deleted documents can be soft deleted.
- Schema version exists.

Implementation direction:

- Define storage interfaces before binding to SQLite details.
- Keep schema migration minimal but present.
- Store enough metadata to support query results and future UI status.

## Phase 5: Embeddings and Vector Index

Add OpenAI-compatible embedding and sqlite-vec.

Expected result:

- Chunks can be embedded in batches.
- Embedding cache can avoid repeated work.
- Vectors can be stored.
- Index configuration hash is recorded.

Implementation direction:

- Implement one OpenAI-compatible provider first.
- Use provider, model, dimensions, and chunk hash for embedding cache identity.
- Keep batch size configurable.
- Add limited retry and backoff for transient provider errors.

## Phase 6: QueryService

Implement protocol-independent retrieval.

Expected result:

- Query text is embedded.
- Vector search returns matching chunks.
- Source filters work.
- Results include normalized score and metadata.

Implementation direction:

- QueryService should depend on EmbeddingProvider and Storage interfaces.
- Keep filtering in query/storage boundaries.
- Return protocol-neutral QueryResult objects.

## Phase 7: MCP Server

Expose retrieval to agents.

Expected result:

- MCP server starts with the core runtime.
- `search_knowledge` works.
- `list_sources` may be added if useful during testing.

Implementation direction:

- Keep MCP as an interface adapter.
- Map MCP tool input to QueryService input.
- Map QueryResult to MCP output without adding reasoning or generated summaries.

## Phase 8: Watcher and Incremental Indexing

Add automatic updates.

Expected result:

- File changes enqueue jobs.
- Debounce works.
- Pending jobs are coalesced.
- Deletes are reflected in storage.
- Failed jobs retry with limits.

Implementation direction:

- Use file events as triggers.
- Keep startup scan as the reconciliation mechanism.
- Treat rename and move as delete plus add.
- Do not add a persistent job queue in P0.

## Phase 9: Validation Pass

Validate the Core MVP as an end-to-end system.

Expected result:

- A local Markdown folder can be configured.
- Initial scan indexes documents.
- MCP query returns relevant chunks.
- Modifying a Markdown file updates results after indexing.
- Deleting a Markdown file removes results from default query output.
- Logs expose indexing and provider failures.

Implementation direction:

- Prefer end-to-end tests around the core loop once the pieces exist.
- Keep provider-dependent tests isolated or mocked.
- Use small fixture Markdown files for repeatable indexing tests.

## Later Product Shell

The Tauri taskbar UI belongs after Core MVP validation.

Expected later result:

- Tauri starts or connects to MindWeave Core.
- Users can configure sources.
- Users can see source and index status.
- Users can open source files and log folders.
