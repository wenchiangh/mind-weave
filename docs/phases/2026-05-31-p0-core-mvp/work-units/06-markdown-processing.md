# Markdown Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Markdown document processing behind the `DocumentProcessor` contract, producing stable natural-language chunks suitable for embedding and query result return.

**Architecture:** Markdown processing belongs to `src/processors`. It converts already-loaded document content into MindWeave-owned chunks. It must not read files, scan sources, write storage, call embedding providers, or depend on CLI/runtime adapters.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, shared identity helpers from WU-05.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#9-markdown-processing`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#10-identity-rules`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/05-identity-and-document-fingerprint.md`

## Current Starting Point

WU-05 added shared helpers for:

- `createChunkContentHash`
- `createChunkId`
- `normalizeChunkText`

Current processor contracts already define:

- `DocumentProcessor`
- `ProcessableDocument`
- `ProcessedChunk`

## Splitter Decision

The detailed design prefers a TypeScript Markdown/RAG splitter behind an adapter layer. During WU-06 execution, npm package probing did not return reliably in the current environment. To avoid blocking P0 on package selection, WU-06 will implement a deterministic local Markdown section splitter behind a small processor-owned adapter boundary.

This is not intended to become a permanent framework. It should remain replaceable by `@langchain/textsplitters`, LlamaIndex.TS, or another splitter later if one proves better after a dedicated dependency spike.

The local splitter is acceptable for WU-06 because it implements only the accepted P0 behavior:

- heading and paragraph boundaries
- heading context in chunk text
- oversized section splitting by character length
- overlap only inside oversized sections
- frontmatter stripping
- no graph semantics
- no tokenizer or LLM dependency

## Non-Goals

- Do not read files from disk.
- Do not implement a full Markdown parser.
- Do not resolve links, wikilinks, backlinks, tags, or Obsidian graph semantics.
- Do not do table-specific semantic extraction.
- Do not call an LLM.
- Do not compute embeddings.
- Do not write storage.
- Do not implement indexing queue behavior.
- Do not add a separate chunk title or heading path field.
- Do not leak splitter-specific types outside `src/processors`.

## Markdown Processing Behavior

`MarkdownProcessor` should implement `DocumentProcessor`.

It should:

- Support `fileType: "markdown"`.
- Treat Markdown headings as natural-language section boundaries.
- Include heading context directly in emitted chunk text.
- Preserve content close to source text.
- Strip raw frontmatter before chunking.
- Ignore empty sections.
- Split oversized section text by character length.
- Apply overlap only within oversized sections.
- Produce deterministic chunk ordering.
- Compute `contentHash` from final chunk text.
- Compute `chunkId` from `documentId`, chunk index, and content hash.

Defaults:

- `maxChunkChars`: `3000`
- `overlapChars`: `300`

The processor may accept optional constructor settings for tests and future runtime config, but P0 config does not need to expose chunking settings yet.

## Chunk Text Rules

Chunk text should be the single primary text field used for both embedding and query result return.

When a chunk belongs under headings:

- Include ancestor headings before the section body.
- Keep heading markers such as `#` and `##` because they preserve lightweight structure.
- Do not store a separate title field.

When content appears before the first heading:

- Emit it as normal chunk text without heading context.

Frontmatter:

- If the document starts with YAML-style frontmatter delimited by `---`, strip that block.
- Do not emit frontmatter as a normal chunk.
- If frontmatter syntax is incomplete, treat it as normal content rather than throwing.

## Oversized Section Splitting

Oversized chunk splitting should be deterministic and simple:

- Try to split on paragraph boundaries first.
- If a paragraph is still too large, split by character windows.
- Each emitted chunk should be at most approximately `maxChunkChars` unless one atomic text boundary makes that impractical.
- Add up to `overlapChars` of trailing text from the previous oversized chunk to the next oversized chunk.
- Do not add overlap across different heading sections.

## File Responsibilities

Expected files:

- `src/processors/markdown.ts`
  - Own `MarkdownProcessor`.
  - Own processor-owned splitter adapter and default settings.
  - Normalize splitter output into `ProcessedChunk`.

- `src/processors/index.ts`
  - Re-export processor contracts and Markdown processor APIs intended for current use.

- `src/processors/markdown.test.ts`
  - Own Markdown processor behavior tests.

Existing files may change:

- `src/index.ts`
  - Export Markdown processor APIs if useful for current package surface.

## Testing Strategy

Tests should cover:

- processor supports `markdown` and rejects unsupported file types.
- heading sections produce chunks with heading context in chunk text.
- content before the first heading is emitted.
- raw frontmatter is stripped.
- incomplete frontmatter remains normal content.
- oversized sections split by configured small test size.
- overlap is applied within oversized sections.
- overlap is not applied across different heading sections.
- content hashes are computed from final chunk text.
- chunk IDs are computed from document ID, chunk index, and content hash.
- output is deterministic across repeated runs.
- external splitter types do not leak outside processor module.

## Implementation Tasks

### Task 1: [x] Create Markdown Processor and Splitter Adapter

**Files:**

- Create: `src/processors/markdown.ts`
- Create: `src/processors/markdown.test.ts`
- Create: `src/processors/index.ts`

Plan:

- Implement `MarkdownProcessor` behind `DocumentProcessor`.
- Add processor-owned splitter settings with defaults.
- Keep splitter internals private to the processor module.

Validation:

- Tests cover processor support checks and basic chunk generation.
- Typecheck passes.

### Task 2: [x] Implement Heading and Frontmatter Behavior

**Files:**

- Modify: `src/processors/markdown.ts`
- Modify: `src/processors/markdown.test.ts`

Plan:

- Strip complete YAML-style frontmatter.
- Parse Markdown ATX headings as section boundaries.
- Include ancestor heading context in chunk text.
- Emit content before first heading.

Validation:

- Tests cover heading context, pre-heading content, complete frontmatter stripping, and incomplete frontmatter preservation.

### Task 3: [x] Implement Oversized Section Splitting

**Files:**

- Modify: `src/processors/markdown.ts`
- Modify: `src/processors/markdown.test.ts`

Plan:

- Split oversized section text by paragraph boundaries when possible.
- Split oversized paragraphs by character windows.
- Apply overlap only within oversized sections.

Validation:

- Tests cover oversized sections, oversized paragraphs, and no overlap across heading sections.

### Task 4: [x] Add Identity Integration

**Files:**

- Modify: `src/processors/markdown.ts`
- Modify: `src/processors/markdown.test.ts`

Plan:

- Compute `contentHash` from final chunk text.
- Compute `chunkId` from document ID, chunk index, and content hash.
- Preserve document ID, source ID, and chunk index on each chunk.

Validation:

- Tests prove deterministic hashes and chunk IDs.
- Repeated processing returns identical output.

### Task 5: [x] Public Exports and Boundary Checks

**Files:**

- Modify: `src/index.ts`
- Add or update processor boundary tests if useful.

Plan:

- Export Markdown processor APIs.
- Ensure processors do not import config, app, CLI, source discovery implementation, storage, indexing, embeddings, or query modules.

Validation:

- Boundary tests pass.
- `pnpm typecheck` passes.
- `pnpm test` passes.

### Task 6: [x] Mark WU-06 Passed and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/work-units/06-markdown-processing.md`

Plan:

- During implementation, move WU-06 status through `implementing` and `testing`.
- After validation passes, mark WU-06 as `[x] Status: passed`.
- Mark all checklist tasks in this plan as complete.
- Commit this work unit separately.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- Worktree is clean except unrelated pre-existing untracked files.

## Success Check

WU-06 is successful only if:

- Markdown documents can be converted into stable `ProcessedChunk` objects.
- Heading context is included directly in chunk text.
- Frontmatter is not emitted as a normal content chunk.
- Oversized sections split deterministically with within-section overlap.
- `contentHash` and `chunkId` follow WU-05 identity helpers.
- Processor module remains independent from config, app, CLI, storage, indexing, embeddings, and query modules.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If MarkdownProcessor does not exist, resume at Task 1.
- If heading/frontmatter behavior is incomplete, resume at Task 2.
- If oversized splitting is incomplete, resume at Task 3.
- If chunk hashes or IDs are missing, resume at Task 4.
- If exports or boundary checks are missing, resume at Task 5.
- If validation passed but docs are not marked complete, resume at Task 6.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan matches accepted Markdown processing behavior from detailed design.
- [x] The plan keeps Markdown processing separate from indexing and storage.
- [x] The plan keeps splitter internals replaceable.
- [x] The plan includes heading context in chunk text instead of a separate title field.
- [x] The plan uses WU-05 identity helpers for chunk hash and chunk ID.
