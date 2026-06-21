# MCP Tool Contract Review

This document reviews the current MCP retrieval contract after P0.7 evaluation.

## Current Contract

Current tools:

- `search_knowledge`
- `list_sources`

`search_knowledge` input:

- `query`
- `limit`
- `includeSourceIds`
- `excludeSourceIds`
- `fileTypes`
- `scoreThreshold`

`search_knowledge` output currently returns `QueryResult` fields:

- `chunkId`
- `documentId`
- `sourceId`
- `sourceName`
- `uri`
- `text`
- `score`
- `documentStatus`
- `sourceStatus`
- `sourceUpdatedAt`
- `indexedAt`
- optional `metadata`

## What Worked

The existing contract is sufficient for most topic-style and effort-style questions.

The agent can:

- retrieve relevant chunks
- inspect chunk text
- see score ordering
- see source identity
- see document identity
- open the source file via `uri` when needed

No evidence suggests a need for generated answers or relevance explanations in MindWeave.

## Contract Gaps

### 1. Missing Relative Path

Agents can derive a readable path from `uri`, but this is unnecessary friction.

Recommendation:

```text
Add `relativePath` to QueryResult when available.
```

Why:

- easier source display
- easier path-prefix reasoning
- easier user-facing citations
- easier future source/path filtering

### 2. Missing Chunk Index

`chunkId` is stable but opaque.

Recommendation:

```text
Add `chunkIndex` to QueryResult.
```

Why:

- helps agents understand document position
- helps future source-open workflows jump near the right chunk
- supports debugging retrieval quality

Contract note:

- `chunkIndex` is current-version positional metadata.
- It is not a stable cross-version anchor.
- It should not be used as a cache key by itself or as a persistent citation identifier.

### 3. Missing Structured Heading Path

Current chunk text includes heading context, but heading path is not structured metadata.

Recommendation:

```text
Add `headingPath` metadata for Markdown chunks.
```

Why:

- helps agents understand the section without parsing chunk text
- improves source citation and source-open behavior
- helps distinguish broad overview chunks from specific subtopic chunks

This does not require a new tool. It requires Markdown processor metadata and QueryResult metadata propagation.

Metadata note:

Chunk metadata may expand by file type, but only when the metadata is derived from the current processor output, can be discarded and rebuilt, and does not participate in chunk identity, embedding cache identity, or storage lifecycle decisions.

### 4. No Path-Prefix Filter

The `daily-recent-ai` eval showed that path/source-area intent can be ambiguous. Current source filters are too coarse when a single source contains Daily, Atlas, Efforts, and README paths.

Recommendation:

```text
Do not add path filters immediately.
```

Reason:

- the eval set has only one weak path-oriented case
- path-prefix filtering can be added later if repeated agent workflows need it
- adding `relativePath` first gives agents enough metadata to inspect and learn this need

### 5. No `get_document` Tool

Some cases would benefit from opening the source document, but agents with filesystem access can already use `uri`.

Recommendation:

```text
Do not add `get_document` yet.
```

Reason:

- it duplicates file access for capable local agents
- it increases tool surface area
- current evidence points to metadata gaps first, not a new document-reading tool

## Decision

Recommended next implementation work:

```text
Enhance retrieval result metadata.
```

Minimal change set:

- add `relativePath` to stored vector search result and `QueryResult`
- add `chunkIndex` to stored vector search result and `QueryResult`
- add Markdown `headingPath` chunk metadata
- preserve existing `search_knowledge` tool name and input contract
- do not add new tools yet

This is a small runtime contract hardening step, not a new product direction.

## Agent Workflow Decision

The agent workflow should be documented as:

```text
search_knowledge first
  -> answer from chunks when sufficient
  -> open source file only when broader context is needed
  -> revise query or report insufficient local context when retrieval is weak
```

This workflow is already viable with the current tool contract. Metadata improvements will make it easier and less error-prone.
