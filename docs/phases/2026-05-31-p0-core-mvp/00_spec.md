# P0 Core MVP Spec

## Goal

Build the first usable MindWeave Core runtime: a TypeScript process that indexes local Markdown files and exposes semantic chunk retrieval to agents through MCP.

## Scope

P0 focuses on the core knowledge connection loop:

```text
Configured local folders
  -> Markdown discovery
  -> indexing
  -> embedding
  -> SQLite/sqlite-vec storage
  -> QueryService
  -> MCP search
```

The result should prove that an agent can query local personal knowledge through MindWeave without directly exploring files.

## Included Capabilities

P0 includes:

- Node.js / TypeScript runtime.
- Config file based setup.
- Local filesystem source.
- Markdown document discovery.
- Startup scan.
- File watching.
- In-memory index job queue.
- Debounce and pending job coalescing.
- Markdown chunking.
- Document fingerprint and chunk content hash.
- OpenAI-compatible embedding provider.
- Batch embedding.
- SQLite metadata store.
- sqlite-vec vector search.
- QueryService.
- MCP server.
- Log file output.

## Out-of-Scope for P0

These are intentionally left to later phases:

- Tauri taskbar UI.
- Human query playground.
- Chunk or source preview UI.
- Plain text indexing.
- Code-aware indexing.
- PDF, docx, xlsx, image, or OCR processing.
- Multiple active embedding configurations.
- Automatic plugin discovery.
- Persistent job queue.
- Multi-user collaboration.
- Cloud sync.

## Source Behavior

P0 supports local filesystem sources.

Each configured source points to a local root directory. The source provider scans the directory and emits document candidates for Markdown files.

Obsidian vaults are treated as normal folders.

Nested sources should be rejected or reported as configuration conflicts.

Rename and move are handled as delete plus add.

## Indexing Behavior

The indexer owns all decisions about whether a discovered document needs processing.

Expected flow:

```text
Document candidate
  -> enqueue job
  -> debounce/coalesce
  -> read current file content
  -> compare document fingerprint
  -> skip unchanged documents when fingerprint matches
  -> produce chunks
  -> compute chunk content hashes
  -> preserve embeddings for unchanged chunk occurrences
  -> embed missing chunks
  -> replace document chunks
  -> update vector index
```

Jobs are in-memory. If the runtime exits, the next startup scan reconstructs work by comparing source state and stored document state.

## Chunking Behavior

Markdown chunking should treat Markdown as structured natural-language text.

The processor should include heading context directly in chunk text when available, split oversized sections, and apply small overlap within oversized sections.

Returned chunk text should stay close to source content. P0 does not require a separate heading path field.

## Embedding Behavior

P0 uses one active OpenAI-compatible embedding configuration.

Configuration should include provider type, model, base URL, API key, and optional dimensions.

Changing embedding model or chunking strategy invalidates existing vectors and should require restoring the previous config or resetting the index.

## Storage Behavior

P0 uses SQLite for metadata and sqlite-vec for vector search.

Storage should persist:

- Sources.
- Documents.
- Chunks.
- Embedding records.
- Vector rows.
- Document status.
- Schema marker.
- Index configuration.

Deleted documents and chunks can be soft deleted in P0. Query should exclude deleted rows by default.

## Query Behavior

QueryService accepts plain text query input and optional filters.

Supported query options:

- Limit.
- Include source IDs.
- Exclude source IDs.
- File type filter.
- Score threshold.

Results should be ordered by normalized score, where higher means more relevant.

Each result should include chunk text and enough metadata for traceability.

## MCP Behavior

P0 should expose at least:

```text
search_knowledge
list_sources
```

Deferred additions:

```text
get_chunk
```

The MCP adapter should call QueryService. It should not implement retrieval logic or access storage directly.

## Reliability Expectations

P0 should provide eventual consistency with configured local sources.

The system should combine startup scan, file watching, debounce, document fingerprint, chunk content hash, chunk occurrence embedding preservation, retry limits, and soft delete.

The expected user experience is stable enough for personal knowledge use: new, changed, and deleted Markdown files should eventually be reflected in search results, unchanged documents should usually be skipped through fingerprint comparison, and unchanged chunk occurrences should preserve existing embeddings.

## Acceptance Criteria

P0 is successful when:

- A user can configure one or more local Markdown source folders.
- MindWeave can scan those folders and index Markdown files.
- Markdown files are split into retrievable chunks.
- Embeddings are stored and preserved for unchanged chunk occurrences.
- QueryService can retrieve relevant chunks with metadata.
- MCP `search_knowledge` can be called by an agent.
- File changes eventually update the index.
- File deletion eventually removes results from default query output.
- Logs make indexing and query failures visible.
