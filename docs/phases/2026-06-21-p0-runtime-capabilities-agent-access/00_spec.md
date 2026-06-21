# P0.5 Runtime Capabilities and Agent Access Spec

## Goal

Make MindWeave usable by local agents through a real MCP runtime while preserving the operating-system-independent Core shape.

P0 proved the local retrieval loop:

```text
Local Markdown files
  -> scan/watch triggers
  -> indexing
  -> embeddings
  -> SQLite/sqlite-vec
  -> QueryService
```

P0.5 should turn that validated loop into an agent-accessible runtime:

```text
Agent
  -> MCP stdio server
  -> search_knowledge / list_sources
  -> MindWeave Core
  -> indexed chunks with score and metadata
```

## Positioning

This phase is still Core/runtime work, not product shell work.

The phase should keep MindWeave independent from a specific desktop UI, operating system, or agent application. macOS and Tauri remain future shell concerns. The runtime should be usable from a terminal and should expose capabilities that future shells can compose.

## Scope

P0.5 focuses on:

- Real MCP stdio server startup.
- MCP command semantics.
- Minimal workflow composition around existing scan, watch, query, and MCP behavior.
- Log file output.
- More useful runtime and index status.
- Agent-facing end-to-end validation.

P0.5 should reuse the existing P0 scan and watch implementations. Those implementations were intentionally designed as adapter-backed, replaceable capabilities. This phase should not start with a scan/watch refactor unless implementation exposes a concrete blocker.

## Included Capabilities

P0.5 includes:

- `mindweave mcp --config <path>` style MCP stdio serving.
- MCP tool registration for existing `search_knowledge` and `list_sources` handlers.
- Strict stdout/stderr separation for MCP stdio.
- File logs for runtime, indexing, provider, watcher, and MCP errors.
- Runtime status that reports useful source/index/runtime state.
- A clear command-level distinction between `scan`, `query`, `watch`, `mcp`, and `start`.
- Real or fixture-based MCP client validation.

## Out of Scope

P0.5 does not include:

- Tauri taskbar UI.
- HTTP or Streamable HTTP MCP transport.
- Daemon/service manager integration.
- System tray behavior.
- Non-Markdown indexing.
- Code-aware indexing.
- Persistent job queue.
- Full watcher hardening across all operating systems.
- Rewriting scan/watch into a new capability framework before need is proven.
- Manual human query playground.

## Runtime Command Semantics

The command surface should remain explicit:

- `scan`: run the existing one-shot scan/index convergence path.
- `query`: query the existing index.
- `mcp`: serve MCP over stdio using the current index; do not implicitly scan or start watchers.
- `watch`: if exposed in this phase, run source watchers and indexing worker behavior without MCP.
- `start`: recommended local agent workflow; may compose scan, watch, and MCP serving.

The important rule is that `mcp` is a protocol-serving capability. It should not secretly become an indexing lifecycle workflow.

## MCP Behavior

The initial transport should be stdio.

Reasons:

- It is operating-system-independent in the Node.js runtime.
- It is the common local MCP integration path for agent clients.
- It avoids local port, authentication, origin, and service-discovery complexity.

The MCP server should expose:

```text
search_knowledge
list_sources
```

It should not add answers, summaries, reasoning, or usage guidance. It should return retrieval results and metadata.

## Scan and Watch Behavior

Existing scan and watch behavior remains the baseline.

Scan already performs source discovery, upsert enqueueing, delete reconciliation, indexing, and queue drain.

Watch already normalizes local Markdown file events into document upsert/delete jobs through the queue. It is a P0 simplified implementation with startup scan as the consistency backstop.

P0.5 may document follow-up improvements such as ambiguous event fallback or a future sync coordinator, but should not treat them as prerequisites for real MCP agent access.

## Observability

P0.5 should make failures diagnosable without a UI.

Minimum useful visibility:

- Log file location is stable.
- MCP stdio logs do not pollute stdout.
- Provider authentication and request failures are visible.
- Indexing failures are visible.
- Watcher startup/runtime errors are visible.
- Status can show whether the index contains useful data.

## Acceptance Criteria

P0.5 is successful when:

- A user can configure a local Markdown source and embedding provider.
- A user can run scan to build the index.
- A real MCP stdio server can be started from the command line.
- An MCP client can call `search_knowledge` and receive chunk text, score, source, document, and status metadata.
- `mcp` can serve an existing index without implicitly running scan/watch.
- `start` has documented and tested workflow semantics.
- Logs make runtime, MCP, indexing, watcher, and provider failures visible.
- Status is useful enough to diagnose empty or failed retrieval.

