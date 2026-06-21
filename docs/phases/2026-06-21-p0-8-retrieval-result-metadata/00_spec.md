# P0.8 Retrieval Result Metadata Spec

## Purpose

P0.8 hardens the retrieval result contract after the P0.7 agent workflow evaluation.

The goal is to make returned chunks easier for agents to locate, cite, debug, and decide whether to open as source documents. This phase does not add generated answers, relevance explanations, new retrieval tools, HTTP transport, or UI behavior.

## Background

P0.7 showed that `search_knowledge` is already useful as the first agent-facing retrieval entry point. The main gap is not retrieval capability. The gap is result ergonomics:

- agents can read chunk text, but source location is not always convenient
- agents can see `chunkId`, but not the chunk's readable position in a document
- Markdown chunks include heading context in text, but heading context is not structured metadata

This phase implements the smallest contract hardening that addresses those gaps while preserving the existing tool surface.

## Contract Changes

### QueryResult.relativePath

Add optional `relativePath` to `QueryResult` when the source can provide it.

Semantics:

- `relativePath` is the document path relative to its source root.
- It uses `/` separators.
- It is for display, citation, path-area reasoning, and future path filters.
- It is not a filesystem guarantee. Non-filesystem sources may omit it or define source-relative location in their own adapter.

Rationale:

- `uri` is the document's absolute or source-specific locator.
- `relativePath` is easier for agents and users to read.
- Returning `relativePath` avoids forcing every agent to parse a local file URI.

P0.8 should not add `absolutePath`.

Reason:

- `uri` already carries the openable document locator for local files.
- `absolutePath` would make the core contract more filesystem-specific.
- Future source types may not have a meaningful absolute path.

If later UI or source-opening workflows need the source root, prefer a source-level locator such as `source.uri` or `sourceRootUri` rather than duplicating absolute document paths in every query result.

### QueryResult.chunkIndex

Add `chunkIndex` to `QueryResult`.

Semantics:

- `chunkIndex` is the chunk's current ordinal position in the latest successfully processed version of its document.
- It starts at `0`.
- It must be continuous within a processed document.
- It follows Markdown natural reading order for Markdown documents.
- It is volatile positional metadata.

`chunkIndex` must not be treated as:

- a stable cross-version anchor
- a persistent citation identifier
- a cache key by itself
- a semantic section identity

Rationale:

- `chunkId` is opaque.
- Agents benefit from knowing whether a chunk came from the beginning, middle, or later part of a document.
- Debugging retrieval quality is easier when results show document-local position.

Maintenance expectation:

- The processor should recompute chunk indexes from the current document content.
- If earlier document content changes, later chunk indexes may change.
- That churn is acceptable because this field is only a current-version position.
- Tests should verify current-version correctness, not cross-version stability.

### Markdown metadata.headingPath

Add Markdown `headingPath` as chunk metadata.

Suggested shape:

```json
{
  "headingPath": ["Parent Heading", "Child Heading"]
}
```

Semantics:

- `headingPath` is Markdown-specific derived metadata.
- It records the active Markdown heading hierarchy for the chunk.
- It is generated from the current parse result.
- It may be absent for chunks outside headings.
- It may be absent for non-Markdown document types.
- It is not a chunk title, stable ID, or graph relationship.

Rationale:

- Markdown headings are meaningful natural-language structure.
- Agents should not need to parse chunk text to understand the section context.
- It helps distinguish broad overview chunks from specific subtopic chunks.

Maintenance expectation:

- The Markdown processor should maintain the active heading stack while walking the document in natural reading order.
- Each emitted chunk should receive the heading stack that is active at the chunk's start.
- Heading changes should affect later chunks only through the current parse result; no cross-version heading reconciliation is required.
- If a document edit changes heading structure, affected chunks may receive different `headingPath` values after reprocessing.
- That churn is acceptable because `headingPath` is current-version structure metadata.
- Tests should verify current-version correctness for nested headings, heading transitions, and chunks outside headings.

Like `chunkIndex`, `headingPath` is part of Markdown processor output correctness. Unlike chunk text and content hash, it must not affect chunk identity, embedding reuse, or delete/update behavior.

## Metadata Extension Rule

Chunk metadata may expand by file type, but P0.8 should follow a strict rule:

```text
Only add metadata that is automatically derived from the current processor output, can be discarded and rebuilt, and does not participate in chunk identity, embedding cache identity, or storage lifecycle decisions.
```

This keeps metadata useful without increasing core maintenance pressure.

Acceptable metadata:

- describes current processor-derived structure
- is optional
- is source/file-type specific
- is safe to drop and regenerate
- is returned as context for agents

Not acceptable for P0.8:

- metadata that requires cross-version reconciliation
- metadata that requires stable semantic IDs
- metadata that changes delete/update behavior
- metadata that requires graph modeling
- metadata that becomes part of embedding reuse decisions

By this rule, Markdown `headingPath` is acceptable because it is derived fresh from Markdown parsing and does not affect chunk identity or indexing lifecycle.

The rule does not mean metadata is informal or untested. Once a processor exposes file-type metadata, that processor owns the current-version maintenance logic and tests for that metadata. The limit is that the processor does not need to preserve metadata stability across document versions.

## Data Flow

Expected flow:

```text
LocalFsSourceProvider
  -> candidate with relativePath
  -> IndexingService reads document
  -> MarkdownProcessor emits chunks with index and metadata.headingPath
  -> Storage persists document, chunk, embedding, and metadata
  -> Vector search returns relativePath, chunkIndex, metadata
  -> QueryService maps storage result into QueryResult
  -> MCP search_knowledge returns the same protocol-neutral QueryResult
```

## Scope

In scope:

- add `relativePath` to retrieval results when available
- add `chunkIndex` to retrieval results
- add Markdown `headingPath` metadata
- propagate these fields through storage, query service, CLI query, and MCP output
- tests that prove the returned contract works end to end

Out of scope:

- adding `absolutePath`
- adding `get_document`
- adding path-prefix filters
- changing `search_knowledge` input
- changing vector ranking
- adding generated answers or relevance explanations
- making chunk indexes stable across document versions
- adding metadata for other file types

## Success Criteria

P0.8 is successful when:

- `search_knowledge` results include `relativePath` for local filesystem documents
- `search_knowledge` results include `chunkIndex`
- Markdown chunks include `metadata.headingPath` when produced under headings
- existing query behavior and scoring are unchanged
- tests cover processor metadata, storage propagation, query mapping, and MCP output
- docs clearly state that `chunkIndex` and `headingPath` are current-version metadata, not stable anchors
