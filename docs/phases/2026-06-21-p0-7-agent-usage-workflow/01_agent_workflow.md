# Agent Workflow for MindWeave Retrieval

This document describes how an upper-level agent should use MindWeave.

MindWeave returns retrieval chunks and metadata. It does not answer the user's question by itself.

## When To Query MindWeave

Query MindWeave when the user intent likely depends on local personal knowledge:

- the user asks about their notes, projects, plans, or prior thinking
- the user asks for a topic that may exist in their knowledge base
- the user asks for continuity with previous work
- the task benefits from source-backed personal context
- the agent needs a fast first pass before reading local files

Examples:

- "I want to discuss JS equality."
- "How should I think about DP problems?"
- "What did I write about AI coding boundaries?"
- "What was my English learning plan?"
- "Find my notes about Redis persistence."

## When Not To Query MindWeave

Do not query MindWeave when:

- the user asks for a purely general fact and no personal context is useful
- the answer should come from the current repository or open file context
- the user asks for live/latest external information
- the query would expose sensitive local knowledge unnecessarily
- the agent already has enough user-provided context to answer

## Query Construction

Use a compact semantic query.

Prefer:

```text
topic + key terms + expected concept names
```

Examples:

```text
JavaScript equality SameValue Object.is === == type conversion
dynamic programming DP state transition recurrence memoization
Redis persistence RDB AOF cache durability tradeoffs
boundary aware change governance AI coding expected change boundary actual change surface
```

For fuzzy intents, include both user wording and likely note vocabulary.

For source-specific workflows, use source filters when the agent knows the relevant source. In the current single-vault dogfooding config, source filtering is less important because there is only one source.

## Result Interpretation

Read returned chunk text first.

Use score as a ranking signal:

- good top results in the dogfooding vault often appeared around `0.65` to `0.80`
- scores are useful for ordering and coarse filtering
- scores are not answer confidence

Inspect metadata:

- `sourceId`
- `sourceName`
- `documentId`
- `uri`
- `documentStatus`
- `sourceStatus`
- `sourceUpdatedAt`
- `indexedAt`

If top chunks identify the right document but omit needed surrounding context, open the source document.

## Answering With Retrieved Chunks

If chunks are enough:

- answer using the retrieved structure and terminology
- mention that the answer is based on local notes when relevant
- avoid overclaiming beyond the chunk content

If chunks are partial:

- state the local note gives partial context
- open the source document if file access is available and broader context is needed

If chunks are weak:

- reformulate the query once with better terms
- if retrieval remains weak, say local knowledge did not return enough context

## Recommended Tool Sequence

For most personal-knowledge questions:

```text
search_knowledge
  -> answer if chunks are enough
  -> open source document only if needed
```

For source inventory questions:

```text
list_sources
  -> search_knowledge with source filter if useful
```

## Current Contract Friction

The current contract is usable, but agent ergonomics would improve with:

- `relativePath`
- `chunkIndex`
- structured `headingPath`

The chunk text currently includes heading context, but structured heading metadata would make source inspection and citation easier.
