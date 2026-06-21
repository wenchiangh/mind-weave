# P0.6 Dogfooding Hardening Spec

## Goal

Improve the real first-run and daily-use experience revealed by dogfooding, without changing MindWeave's product boundary or adding a UI shell.

P0 and P0.5 proved the core loop:

```text
local Markdown
  -> scan/index/embed
  -> SQLite/sqlite-vec
  -> query
  -> MCP retrieval for agents
```

P0.6 should make that loop easier to trust, inspect, and operate during real use.

## Positioning

This phase is still Core/runtime/CLI hardening.

It should not become a product shell, chat interface, or autonomous knowledge manager. The user-facing surface remains a lightweight CLI and MCP runtime that future UI or agent clients can compose.

## Source Finding

The first real vault trial showed that RAG is useful, but operational visibility is too weak.

The most important gaps were:

- first scan has no progress feedback
- `status` does not expose enough index detail
- source exclude validation is manual
- provider readiness is easy to discover only after failure
- score semantics need clearer guidance
- MCP client setup needs a concrete local-use guide

See `00_dogfooding_findings.md` for the observed trial details.

## Scope

P0.6 focuses on small improvements that make the existing runtime usable with less manual inspection.

In scope:

- source dry-run inspection before indexing
- richer status and index diagnostics
- scan progress visibility for CLI/log use
- provider readiness checks that do not call the provider
- local MCP usage documentation
- score interpretation documentation
- targeted tests that preserve current architecture boundaries

Out of scope:

- Tauri or macOS menu bar UI
- HTTP MCP transport
- background daemon/service integration
- persistent job queue
- non-Markdown source types
- code-aware indexing
- graph retrieval
- generated answers, summaries, or relevance explanations
- replacing the existing scan/watch architecture

## Design Principles

### Keep Core Generic

Source inspection, status, and scan progress should be runtime capabilities, not CLI-only hacks.

The CLI may display them first, but future Tauri, TUI, or agent-facing surfaces should be able to reuse the same core data.

### Keep MCP Protocol Output Safe

Any scan progress or diagnostics must not pollute MCP stdout.

MCP remains a retrieval protocol surface. Operational logs and progress belong in CLI output, status, stderr, or log files depending on command context.

### Prefer Read-Only Diagnostics First

Before adding new indexing behavior, expose what the system already knows.

The first improvements should make it clear:

- what would be indexed
- what is already indexed
- what was skipped
- whether provider configuration is ready
- where logs and storage live

### Keep Confidence Claims Narrow

Scores should be presented as retrieval ranking signals, not answer confidence.

MindWeave should continue returning chunks and metadata. The calling agent remains responsible for deciding whether results are enough.

## Included Capabilities

### Source Inspection

Add a read-only way to inspect source candidates without writing to storage or calling the embedding provider.

Expected output should include:

- source id and name
- root URI/path
- included Markdown document count
- skipped or excluded count where practical
- counts by top-level path
- sample included paths
- sample excluded paths when exclusion tracking is available

This can start as a CLI command, but the underlying logic should live behind reusable source/runtime boundaries.

### Richer Runtime Status

Extend status beyond document status counts.

Minimum useful additions:

- total document count by status
- total chunk count
- total embedding count
- source-level document counts
- storage path
- log path
- provider configuration summary
- provider environment readiness without exposing secrets

Status must remain read-only and must not:

- scan sources
- start watchers
- start MCP
- call embedding APIs

### Scan Progress Visibility

Expose enough progress for long first-run scans.

Minimum useful events:

- scan started
- source discovery started/finished
- documents discovered
- document indexing started/finished
- chunk/embedding counts when available
- failures
- scan finished

The first implementation can be coarse-grained. It does not need precise percent completion.

### Provider Readiness Check

Provide a cheap local check for provider configuration.

It should verify:

- configured provider type
- model name exists in config
- base URL exists in config
- required API key environment variable is present or missing
- dimensions are configured when needed by storage

It should not make a network request in the normal readiness path.

### Usage Documentation

Document the working local flow:

```text
configure source
  -> inspect source
  -> check status/provider readiness
  -> scan
  -> query
  -> serve MCP
```

The documentation should include:

- example local config
- OpenAI-compatible provider environment variable guidance
- `scan`, `query`, `status`, `mcp`, `watch`, and `start` command semantics
- example MCP stdio client configuration
- recommended agent workflow: RAG first, open source file only when needed
- score interpretation guidance

## Acceptance Criteria

P0.6 is successful when:

- a user can preview which Markdown files will be indexed before embedding cost is paid
- status can diagnose an empty or incomplete index without manual SQLite inspection
- first-run scan gives useful progress through CLI output and/or logs
- provider environment readiness can be checked before scan/query failure
- MCP local setup is documented enough for a user to configure an agent client
- score semantics are documented as retrieval ranking signals
- all improvements remain compatible with the existing P0/P0.5 architecture

## Suggested Work Units

### WU-00 Findings and Phase Alignment

Capture dogfooding findings and define this hardening phase.

Observable result:

- `00_dogfooding_findings.md`
- `00_spec.md`
- documentation index updated

### WU-01 Source Inspection

Add read-only source inspection for configured sources.

Observable result:

- command can show included candidates and path counts
- no embedding provider call
- no storage mutation

### WU-02 Richer Status

Add chunk, embedding, source-level, and provider-readiness diagnostics to status.

Observable result:

- status output explains indexed content more completely
- missing API key is visible without a query failure

### WU-03 Scan Progress

Add coarse progress events for scan and indexing.

Observable result:

- long scans show progress in CLI/log output
- MCP stdout remains protocol-only

### WU-04 Local Usage Guide

Document the local dogfooding workflow and MCP client setup.

Observable result:

- a user can reproduce the real vault setup without reading implementation code

### WU-05 Dogfooding Re-Validation

Repeat the real-vault validation after hardening.

Observable result:

- inspect/status/scan/query/MCP flow works end to end
- remaining user-experience gaps are recorded before moving forward
