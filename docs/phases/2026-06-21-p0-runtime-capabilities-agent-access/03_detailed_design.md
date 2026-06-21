# P0.5 Runtime Capabilities and Agent Access Detailed Design

This document records phase-level design decisions for P0.5. It is more concrete than the phase spec, but it is not an executable implementation plan.

## 1. Design Goal

Decision status: `Accepted`

P0.5 should make MindWeave usable by agents through a real MCP runtime without turning the project into a UI-first or operating-system-specific application.

The phase should preserve the existing modular Core design:

```text
sources / indexing / processors / embeddings / storage / query / app / interfaces
```

The phase should prefer incremental extension over broad restructuring.

## 2. Scope Boundary

Decision status: `Accepted`

P0.5 should focus on agent access and operational visibility.

In scope:

- MCP stdio serving.
- CLI command integration for MCP serving.
- Log file output.
- Status enrichment.
- Workflow semantics around existing scan/watch/query/MCP behavior.
- Agent-facing validation.

Out of scope:

- Tauri UI.
- HTTP MCP transport.
- Daemon/service management.
- Non-Markdown indexing.
- Persistent queue.
- Scan/watch rewrite.

## 3. Existing Scan and Watch Position

Decision status: `Accepted`

Existing scan and watch implementations are valid P0 baselines and should not be refactored first.

Current scan already performs:

- source persistence
- local source scanning
- document upsert enqueueing
- delete reconciliation
- queue drain
- indexing through existing document upsert/delete executors

Current watch already performs:

- local filesystem watch
- Markdown path filtering
- upsert/delete source event normalization
- routing into document-level index jobs
- debounce and coalescing through the queue

These implementations were intentionally designed around replaceable seams. They do not block P0.5.

Follow-up improvements such as ambiguous event fallback, `SourceChangeSignal`, or `SyncCoordinator` should be documented but deferred until there is a concrete need.

## 4. Capability and Workflow Principle

Decision status: `Accepted`

MindWeave should distinguish reusable runtime capabilities from user-facing workflows.

However, P0.5 should not introduce a large capability abstraction before it is needed.

The practical rule for this phase:

- Keep existing scan/watch/query behavior.
- Add MCP serving as a focused runtime/interface capability.
- Clarify workflow semantics at the command level.
- Extract capability/workflow abstractions later if orchestration duplication appears.

Command semantics:

- `scan`: one-shot scan and index convergence.
- `query`: read-oriented semantic retrieval.
- `mcp`: MCP stdio serving over the current index only.
- `watch`: optional independent watcher-driven indexing workflow.
- `start`: recommended local agent workflow; may combine scan, watch, and MCP serving.

## 5. MCP Stdio Transport

Decision status: `Accepted`

P0.5 should implement stdio transport first.

Rationale:

- stdio is operating-system-independent for a Node.js process.
- local agents commonly support stdio MCP servers.
- stdio avoids HTTP server, local port, authentication, origin, and discovery complexity.

The MCP stdio adapter should:

- register existing tool definitions
- call existing MCP tool handlers
- read protocol messages from stdin
- write protocol messages to stdout
- send diagnostics to stderr or file logs

It should not:

- implement retrieval logic
- access SQLite directly except through approved runtime/storage service boundaries already used by handlers
- start scan or watch implicitly
- write non-protocol logs to stdout

## 6. MCP Tool Contract

Decision status: `Accepted`

P0.5 should keep the existing tool contract:

- `search_knowledge`
- `list_sources`

`search_knowledge` returns retrieval results, not answers.

Result shape should preserve:

- chunk text
- normalized score
- source identity
- source name
- document identity
- URI
- document status
- source status
- source update time
- index time

The MCP layer should not add generated explanations such as why a chunk is relevant or how the agent should use it.

## 7. Logging Design

Decision status: `Accepted`

P0.5 should add a small logging module rather than mixing logs into CLI, MCP, indexing, or storage code.

Recommended module:

```text
src/observability/
```

Initial responsibilities:

- create log directory
- write runtime log events
- support file sink
- support stderr sink for stdio-safe diagnostics

The logger should keep secrets out of logs by default.

Minimum events:

- runtime start/stop
- scan start/finish/failure
- watcher start/stop/failure
- indexing failure
- embedding provider failure category
- MCP server start/stop/failure

The exact log format remains open. JSONL is the preferred default because it is machine-readable for future UI, but a simpler structured text format is acceptable if implementation proves cleaner.

## 8. Status Design

Decision status: `Accepted`

P0.5 status should move beyond config-only status.

Minimum useful status:

- configured source list
- embedding provider, model, and dimensions
- storage type and path when safe to expose
- log path
- source count
- document counts by status
- recent error summary where available

Status should remain read-only.

Status must not:

- run scan
- start watchers
- start MCP
- call embedding providers

## 9. Runtime Structure

Decision status: `Accepted`

P0.5 may add new files for MCP transport and observability without reorganizing the whole source tree.

Recommended additions:

```text
src/interfaces/mcp/stdio-server.ts
src/observability/logger.ts
```

Potential additions if needed:

```text
src/app/mcp-runtime.ts
src/app/status.ts
```

Large-scale movement into `src/core/` is not recommended. The current module layout already matches the architecture documents, and empty historical `src/core` and `src/adapter` directories have been removed.

## 10. Testing Strategy

Decision status: `Accepted`

Normal tests should stay deterministic and offline.

Required coverage:

- MCP stdio server can register and call tools through a test client or protocol fixture.
- `mcp` command does not run scan/watch implicitly.
- MCP stdout contains only protocol output.
- logs go to stderr/file sink, not stdout.
- status reports document counts and relevant runtime paths.
- existing scan/query/watch tests continue passing.

Live provider validation with OpenRouter or another external provider should remain manual or opt-in.

## 11. Completion Definition

Decision status: `Accepted`

P0.5 is complete when:

- MCP stdio serving works with existing indexed knowledge.
- A local agent or fixture MCP client can call `search_knowledge`.
- command semantics are explicit and tested.
- logs and status are useful enough to diagnose common failures.
- no OS-specific UI or daemon assumptions have entered Core.
- remaining scan/watch hardening work is documented as follow-up rather than hidden.
