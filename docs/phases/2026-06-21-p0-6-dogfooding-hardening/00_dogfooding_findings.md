# P0.6 Dogfooding Findings

This document records findings from the first real local-vault dogfooding session after P0.5.

The session used a real Obsidian vault as one local filesystem source, excluded old or non-authoritative paths, built embeddings through an OpenAI-compatible provider, and compared RAG retrieval against direct filesystem exploration.

## Trial Setup

Knowledge source:

```text
/Users/wenchiangh/Library/Mobile Documents/iCloud~md~obsidian/Documents/Wen-Chiang's Notebook
```

Source configuration:

- one `local-fs` source for the whole vault
- regex excludes for old note structures and non-knowledge support folders
- Markdown-only indexing through the existing local filesystem source provider
- OpenAI-compatible embedding provider using `openai/text-embedding-3-small`
- SQLite/sqlite-vec storage under the user MindWeave config directory

Effective excludes:

```text
^(02_Zettel|03_Atlas|04_Projects)(/|$)
^(90_Archive|90_Assets|99_Extras)(/|$)
^(AGENT|Welcome)\.md$
```

The local filesystem scanner already ignores hidden paths such as `.obsidian` and `.agents`, and skips non-Markdown files.

## Observed Result

The first full scan completed successfully.

Observed index state:

- 73 indexed documents
- 620 chunks
- 620 embeddings
- 0 failed documents
- 0 excluded-path documents in the final index

Top-level indexed paths:

- `00_Daily`: 35 documents
- `20_Atlas`: 31 documents
- `10_Efforts`: 6 documents
- `README.md`: 1 document

The first scan took roughly three minutes for this vault and provider.

## Retrieval Behavior

The RAG path worked for both precise and fuzzy user intents.

Precise topic:

```text
JavaScript equality SameValue Object.is === ==
```

The top result correctly matched:

```text
20_Atlas/Computing/JavaScript/03_Type Conversion and Equality.md
```

The returned chunk contained the relevant distinctions between strict equality, abstract equality, and `Object.is`.

Fuzzy topic:

```text
dynamic programming DP solving patterns techniques state transition recurrence
```

The top results correctly matched:

```text
20_Atlas/Computing/Solving Patterns.md
```

The highest-ranked chunks covered:

- state and transition
- common DP types
- memoized search and bottom-up recurrence
- the core signal for when DP is appropriate

This validates the core hypothesis that MindWeave can serve as a semantic entry point into a user's curated personal knowledge.

## RAG vs Direct Filesystem Exploration

Direct filesystem exploration also found the correct DP note, but it required more agent work:

- list or search file paths
- guess useful keywords
- avoid old structures such as `02_Zettel`, `03_Atlas`, and `04_Projects`
- filter false lexical matches such as React `memo`, `useMemo`, or unrelated memory terms
- open and slice a large Markdown file around the relevant heading

The RAG path gave a narrower and more useful first context:

- it used the configured active-knowledge boundary
- it returned chunk-sized context directly
- it avoided excluded old structures
- it ranked the exact DP method chunks above related but less central material

The practical conclusion is not that RAG replaces file reading. The better agent workflow is:

```text
RAG retrieval first
  -> inspect returned chunks and metadata
  -> open source documents only when more context is needed
```

## Exposed Product Issues

### 1. Scan Has No Progress Feedback

During first indexing, the CLI stayed silent until the scan completed.

Users currently need to inspect the database or logs to know whether indexing is progressing. This is especially poor for first-run embedding, where external provider latency can make scans last minutes.

Needed improvement:

- expose progress without changing the core indexing model
- show candidate discovery, document indexing, chunk/embedding counts, failures, and completion
- keep MCP stdout protocol-safe

### 2. Status Is Useful but Still Too Thin

`status` reports document status counts, storage path, and log path, but it does not expose:

- chunk count
- embedding count
- source-level document counts
- last scan start/finish time
- whether the current index looks query-ready

Users should not need ad hoc SQLite inspection for normal diagnosis.

### 3. Source Exclude Validation Is Too Manual

The exclude configuration worked, but validation required manual SQL/Node scripts.

Before paying embedding cost, users need a cheap way to inspect which files a source would include or exclude.

Needed improvement:

- a dry-run source inspection command
- counts by source and top-level path
- sample included and excluded paths
- no embedding provider call
- no index mutation

### 4. Provider Configuration Failure Is Easy to Hit

The config correctly uses `apiKeyEnv`, but the active shell did not have `OPENROUTER_API_KEY`.

The error path exists, but the normal setup flow does not make provider readiness obvious before a scan/query.

Needed improvement:

- status or config check should report missing required environment variables without calling the provider
- setup docs should show the expected environment variable and MCP client command shape
- logs should make provider failures easy to locate

### 5. Score Semantics Need Calibration

Useful results had scores around `0.69` to `0.73`.

The ranking was good, but the absolute number can be misread as a percentage-like confidence value.

Needed improvement:

- document score as a normalized retrieval score for ranking and coarse thresholding, not a proof of correctness
- provide recommended starting thresholds for personal notes
- keep final judgment in the calling agent

### 6. MCP Usage Needs a Concrete Local Client Guide

The runtime can serve MCP, but a user still needs to know how to configure an agent client.

Needed improvement:

- document the local stdio command and args
- document required environment variables
- document the recommended agent workflow: search first, then open source only when needed
- document that `mcp` serves the existing index and does not scan implicitly

## Non-Issues Observed

The following behaved as intended and do not need immediate redesign:

- single-source vault configuration with regex excludes
- Markdown-only indexing
- automatic hidden-path and non-Markdown filtering
- SQLite/sqlite-vec storage for the current scale
- existing chunking quality for method-oriented Markdown notes
- MCP returning retrieval data instead of generated answers

## Product Signal

The trial supports continuing the project.

The demonstrated value is not that MindWeave gives agents filesystem access. Agents can already explore files. The value is that MindWeave turns a personal knowledge folder into:

```text
configured active knowledge
  -> indexed chunks
  -> semantic retrieval
  -> source-backed metadata
  -> agent-usable context
```

The next stage should improve the operational experience around this validated path before expanding scope.

## P0.6 Resolution Summary

P0.6 addressed the first set of dogfooding issues without changing the product boundary.

Resolved or improved:

- source include/exclude behavior can now be inspected before indexing
- status now reports chunk count, embedding count, source-level document counts, and provider API key environment readiness
- scan now emits coarse structured progress events in CLI output and logs
- local usage, MCP setup, recommended agent workflow, and score semantics are documented
- real-vault re-validation confirmed inspect, status, scan progress, and query behavior

Remaining future improvements:

- progress is still coarse, not percentage-based
- source inspection reports excluded path entries but not recursive counts below excluded directories
- provider readiness remains local configuration readiness, not a live network health check
- MCP client setup still depends on each agent application's config format
