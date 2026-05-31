# MindWeave Architecture

## Architectural Goal

MindWeave Core should provide a local RAG runtime over user-configured knowledge sources.

The architecture should keep core capabilities independent from any specific interface. MCP, CLI, TUI, HTTP, and Tauri UI should be adapters over the same core services.

The architecture should be modular, but not over-packaged. A single TypeScript project with clear internal module boundaries is the current default structure.

## System Overview

The initial runtime loop is:

```text
Local Markdown files
  -> SourceProvider
  -> Indexer
  -> MarkdownProcessor
  -> EmbeddingProvider
  -> Storage
  -> QueryService
  -> MCP adapter
```

The query and indexing paths meet at storage:

```text
Indexer writes metadata and vectors
QueryService reads metadata and vectors
```

This separation allows indexing to be slow, retryable, and eventually consistent while query remains a read-oriented operation over the latest successful index.

## Runtime Model

### Core Runtime

The core runtime is a Node.js / TypeScript process.

Startup flow:

```text
Load user config
  -> derive effective config
  -> initialize logger
  -> initialize storage
  -> initialize embedding provider
  -> register source providers
  -> run startup scan
  -> start watchers
  -> start index queue
  -> start MCP server
```

The core should be runnable from a terminal without a desktop UI. This keeps the knowledge runtime independent from product shells.

### Tauri Shell

Tauri is a product shell, not the core runtime.

The likely product-shell model is:

```text
Tauri taskbar app
  -> starts or connects to Node.js sidecar
  -> Node.js sidecar runs MindWeave Core
  -> Tauri UI communicates with Core through local IPC, HTTP, or stdio
```

This keeps the core reusable for future shells and platforms.

## Project Structure

The current default structure is one TypeScript project.

Suggested source layout:

```text
src/
  app/
  sources/
  indexing/
  processors/
  embeddings/
  storage/
  query/
  interfaces/
  shared/
```

Each module should own one part of the system. The architecture does not require a monorepo or split packages at this stage.

## Module Responsibilities

### app

`app` composes the runtime.

Responsibilities:

- Load user configuration.
- Build effective configuration.
- Initialize concrete adapters.
- Wire services together.
- Start and stop the runtime.
- Coordinate lifecycle.

It should not implement source scanning, chunking, embedding, storage, or query logic directly.

### sources

`sources` discovers indexable documents and source changes.

The initial source adapter is `LocalFsSourceProvider`.

SourceProvider should:

- Scan configured roots.
- Find supported files.
- Emit added, modified, and deleted events.
- Return document candidates with source metadata.

SourceProvider should not:

- Read document content for indexing.
- Decide whether content has changed.
- Chunk content.
- Embed content.
- Write to storage.

The indexer owns those decisions.

### indexing

`indexing` is the synchronization center.

Responsibilities:

- Convert scan results and file events into index jobs.
- Maintain an in-memory job queue.
- Merge pending jobs for the same document.
- Debounce noisy file events.
- Load document content.
- Compare document fingerprints.
- Skip unchanged documents.
- Call processors.
- Call embedding providers.
- Write metadata and vectors through storage interfaces.
- Record document and job status.

The indexer should keep synchronization state centralized instead of spreading it across source, processor, and storage modules.

### processors

`processors` converts raw document content into chunks.

The initial document processor is `MarkdownProcessor`.

Markdown processing should treat Markdown as structured natural-language text:

```text
Parse Markdown
  -> identify heading sections
  -> include heading context in chunk text
  -> split oversized sections by length
  -> apply small overlap
  -> produce chunks
```

The processor produces chunks and metadata. It does not embed or store them.

### embeddings

`embeddings` turns text into vectors.

The initial embedding adapter should be OpenAI-compatible.

Provider configuration should include:

- Provider type.
- Model.
- Base URL.
- API key.
- Optional dimensions.

Embeddings belong to chunk occurrences. Different chunk occurrences do not share embedding records, even if their text is identical.

### storage

`storage` persists metadata and vectors.

The initial storage adapter uses SQLite for metadata and sqlite-vec for vector search.

Storage should expose core-facing operations such as:

- Save source.
- Upsert document.
- Replace document chunks.
- Save embeddings.
- Mark document deleted.
- Search vectors.
- Read chunk.
- Read source status.
- Update index state.

SQLite is the first storage adapter, not the architecture itself.

### query

`query` contains protocol-independent retrieval logic.

QueryService should:

- Embed query text using the active embedding provider.
- Search the vector store.
- Apply source and file type filters.
- Apply limit and score threshold.
- Return ordered QueryResult objects.

It should not know whether the caller is MCP, CLI, HTTP, Tauri UI, or another adapter.

### interfaces

`interfaces` exposes Core capabilities to external consumers.

The initial external agent interface is MCP.

Later adapters may include:

- CLI.
- HTTP.
- TUI.
- Tauri UI bridge.

Interface adapters should call Core services instead of implementing business logic.

### shared

`shared` contains small cross-cutting utilities.

Examples:

- Hash helpers.
- ID helpers.
- Logger.
- Error types.
- Path normalization.
- Time helpers.
- Config validation helpers.

Domain concepts should remain in their owning modules rather than moving into `shared`.

## Core Domain Model

### Source

A Source is a configured knowledge source.

In the initial local filesystem adapter, a Source is a local directory containing Markdown files.

It stores source type, root path or URI, display name, configuration, and status.

### Document

A Document is an indexable unit from a Source.

In the initial Markdown workflow, a Document maps to one Markdown file. The abstraction is intentionally broader: in the future, a Document may map to a database row, saved event, exported message, email, or saved web page.

Document identity should be stable within a source. A practical default is a hash of source ID and normalized relative path.

### Chunk

A Chunk is the retrieval unit.

Chunks are produced from Documents and should include text, chunk content hash, chunk index, document ID, source ID, and position metadata when available.

Chunk identity should balance stability and simplicity. A practical first rule is to derive it from document identity, chunk index, and chunk content hash.

### Embedding

An Embedding is the vector representation of text.

Document chunk embeddings are persisted. Query embeddings are usually computed at query time.

Each persisted embedding belongs to one chunk occurrence and should record provider, model, and dimensions.

### IndexJob

An IndexJob represents a pending indexing operation.

The current job model uses in-memory jobs. If the process exits or crashes, startup scan and stored document state should rebuild necessary work.

Job types may include upsert document, delete document, and reindex source.

### QueryResult

A QueryResult is the protocol-neutral retrieval output.

It should include chunk text, normalized score, chunk ID, document ID, source ID, source name, path or URI, source update time, index time, and additional metadata.

The score represents retrieval relevance, not factual correctness.

## Source Design

The initial source design supports local Markdown files.

Priority order:

- Initial: Markdown.
- Next: Plain text.
- Later: Code repositories and code-aware indexing.
- Later: PDF, docx, xlsx, images, and other converted content.

Obsidian vaults are treated as normal folders in the initial local filesystem design.

Ignore rules should start simple. A user-configurable regex exclude list is enough for the initial design. Full `.gitignore` compatibility can be considered later.

The system should reject or warn about nested sources because nested sources complicate identity, deletion, filtering, and duplicate indexing.

Rename and move should be treated as delete plus add. P0 does not try to preserve document identity across moves.

## Indexing Design

The indexing pipeline should be explicit:

```text
Scan result or source event
  -> enqueue job
  -> debounce and coalesce
  -> check file existence
  -> read content
  -> compare document fingerprint
  -> skip if fingerprint is unchanged
  -> process Markdown
  -> compute chunk content hashes
  -> preserve embeddings for unchanged chunk occurrences
  -> embed missing chunks
  -> replace document chunks
  -> update vectors
  -> update document status
```

The current queue design uses an in-memory queue. Durable job recovery is unnecessary while source files are durable and startup scan can reconstruct work.

Pending jobs targeting the same document should be coalesced. Running jobs should not be cancelled. If a new event arrives while a job is running, enqueue a follow-up job.

File events should be debounced before indexing. A path-level debounce of 1 to 3 seconds is a good first default.

Transient failures should retry with a limit. Provider, network, and temporary storage failures are retryable. Unsupported files and parse failures should not retry endlessly.

## Markdown Chunking

Markdown chunking should use Markdown headings and paragraphs as natural-language boundaries with a maximum size limit.

Headings define semantic sections. Heading context should be included directly in chunk text when available, so retrieval can benefit from document structure without requiring a separate heading field.

Oversized sections should be split further by length. Adjacent chunks should use a small overlap, such as 10% to 15% or a fixed token range. Large overlaps should be avoided because they increase duplicate content and retrieval noise.

Raw Markdown frontmatter does not need to become normal content chunk text.

## Embedding Design

The initial embedding adapter should use an OpenAI-compatible embedding API.

This covers cloud providers and many local or self-hosted services that expose compatible request formats.

The system can start with one active embedding configuration at a time. Changing provider, model, dimensions, or chunking strategy should require restoring the previous config or resetting the index because old vectors are no longer compatible with the active index configuration.

Batch embedding should be supported. A simple first strategy is configurable batch size, limited retry, and backoff on rate limits or transient provider errors.

## Storage Design

The initial storage adapter should use SQLite with sqlite-vec.

This is a good fit for local-first personal knowledge:

- Simple deployment.
- Local file storage.
- No separate database service.
- Good enough for early personal knowledge scale.
- Easy to inspect during development.

Storage should track a minimal schema marker and index configuration.

The schema marker describes database structure. Index configuration describes the embedding and chunking rules that produced current vectors.

The initial deletion strategy can use soft delete for documents and chunks. Query should exclude deleted records by default. Later cleanup can hard delete old rows and compact the database.

## Query Design

QueryService should be protocol-independent.

Input should support:

- Query text.
- Limit.
- Include source IDs.
- Exclude source IDs.
- File type filter.
- Score threshold.

Output should be ordered by normalized score.

The public score should be normalized to a 0 to 1 range where higher means more relevant. Raw vector scores can be retained internally for debugging, but public results should be easier for agents to consume.

Source filtering is required from the beginning because agents may need to search within a specific project or knowledge source.

## MCP Interface

MCP is the first external agent interface.

The MCP server should call QueryService and should not access SQLite directly.

The baseline tool is:

```text
search_knowledge
list_sources
```

Later useful tools:

```text
get_chunk
```

Tool schemas should map directly to Core services.

## Configuration Design

Configuration should distinguish:

- User config.
- Effective config.
- Runtime state.

User config is edited by users or UI adapters. Effective config is validated and expanded by the app at startup. Runtime state belongs in storage and logs, not in the user config file.

The initial configuration surface should be a config file. It is simple, inspectable, and independent from UI.

Later UI adapters can edit the same user configuration or call a configuration service that writes it.

## Status and Observability

The system should maintain enough status to support logs, future UI, and safe query filtering.

Suggested states:

Source:

- active
- disabled
- error

Document:

- discovered
- indexed
- stale
- deleted
- failed

Job:

- pending
- running
- succeeded
- failed
- skipped

The core runtime should write logs to files. Product shells can provide an action to open the log folder.

## Reliability Model

MindWeave should be reliable through simple mechanisms rather than heavy coordination.

Reliability mechanisms:

- Startup scan.
- File watching.
- Debounce.
- Pending job coalescing.
- Document fingerprint.
- Chunk content hash.
- Chunk occurrence embedding preservation.
- Limited retry.
- Soft delete.
- Schema marker.
- Index configuration.

This design should provide a stable enough experience for personal knowledge and small team scenarios. The expected standard is not perfect real-time behavior, but a system that converges, avoids repeated expensive work, and makes failures visible.
