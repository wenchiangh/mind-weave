# Runtime SDK Surface Audit

## Purpose

This audit checks whether the current CLI already depends on the Runtime SDK / `AppRuntime` boundary rather than owning reusable runtime logic.

The audit result informs whether P1 Tauri Shell can call the same core runtime surface through a Node.js sidecar bridge without depending on CLI implementation.

## Current Runtime Entry Points

Current runtime construction:

- `createRuntimeFromConfigFile(configPath)`
- `createRuntime(config, options)`
- `getRuntimeHealth()`

Current `AppRuntime` operations:

- `getHealth()`
- `getStatus()`
- `start()`
- `scan(options)`
- `inspectSources()`
- `query(input)`
- `getMcpToolHandlers()`
- `stop()`

## Current CLI Boundary

The CLI currently imports:

- app runtime creation and health helpers
- `AppRuntime` type
- MCP stdio server creation

The CLI does not import lower-level source, processor, embedding, storage, query, indexing, or config modules directly.

This matches the intended adapter rule.

## Capability Table

| Capability | Current Owner | CLI Behavior | Tauri Shell Need | Boundary Assessment |
| --- | --- | --- | --- | --- |
| Health | App/runtime helper | `health` prints JSON | show runtime availability | good |
| Status | AppRuntime | `status` prints runtime status | show runtime/source/index/provider status | good |
| Source inspection | AppRuntime | `inspect` prints report | show include/exclude before scan | good |
| One-shot scan | AppRuntime | `scan` prints progress JSON lines and final status | trigger scan and show progress | mostly good |
| Query | AppRuntime/QueryService | `query` prints result or provider error | not first P1 shell priority | good |
| MCP tool handlers | AppRuntime + MCP adapter | `mcp` serves handlers over stdio | show MCP setup/status, not admin | good for current stdio model |
| Start runtime | AppRuntime | `start` scans, starts watchers, then serves MCP | shell needs more granular control | needs split |
| Watch mode | AppRuntime via `start()` | `watch` calls `runtime.start()` | shell needs start/stop/status for watch | needs split |
| Stop runtime | AppRuntime | called only by tests/lifecycle users | shell sidecar lifecycle needs reliable stop | partially good |
| Config info | implicit in status | status exposes source/storage/provider summary | shell needs read-only config summary and config path | needs explicit shape |
| Log info | status observability | status exposes log path | shell needs log folder/open action | mostly good |
| Provider readiness | status embedding readiness | status exposes key env/presence | shell needs readiness display | good |
| MCP access status | status `mcp.enabled` only | minimal flag | shell needs setup/status language | needs richer read model |

## Existing Good Boundaries

The current CLI is already thin in the important places:

- command parsing stays in CLI
- JSON output stays in CLI
- MCP stdio serving stays in MCP interface code
- status, inspect, scan, query, and MCP handlers come from AppRuntime or app composition
- boundary tests prevent CLI from importing lower-level core modules

This means the project does not need a large CLI extraction before P1.

## Gaps Before Tauri Shell

### 1. Watch Is Not Separately Controllable

`runtime.start()` currently performs:

```text
scan
  -> start watchers
```

CLI `watch` calls `runtime.start()`.

This is acceptable for CLI but too coarse for Tauri. The shell needs to show and control watch independently:

- start watch
- stop watch
- read watch status
- avoid starting MCP as part of watch
- distinguish watch errors from MCP availability

Recommended follow-up:

- add explicit watch lifecycle operations to AppRuntime
- keep `start()` as convenience workflow if still useful
- update CLI `watch` to call the explicit watch operation after the SDK exists

### 2. Runtime Status Does Not Describe Watch State

Current status does not expose watcher state.

The shell needs to show whether filesystem monitoring is:

- stopped
- starting
- running
- stopping
- error

Recommended follow-up:

- add a runtime watch status model
- update tests to prove watch state is independent from MCP status

### 3. MCP Status Is Too Coarse

Current status contains:

```text
mcp.enabled
```

This is not enough for a shell. In the current stdio MCP model, the shell should likely show "MCP available/setup" rather than "MCP running".

Recommended follow-up:

- add `getMcpAccessInfo()` or enrich status with MCP access/setup data
- avoid adding MCP start/stop until a non-stdio serving model is designed
- keep MCP agent access separate from human runtime control

### 4. Config Info Is Embedded In Status

Status exposes useful effective config summaries, but the shell needs a clearer read-only config info surface:

- config file path
- config folder path
- source summaries
- provider summary without secrets
- storage path
- log path

Recommended follow-up:

- add explicit read-only config info to Runtime SDK or status
- keep config editing deferred

### 5. Scan Progress Is Callback-Based

`scan(options.onProgress)` works for CLI JSON lines. It can also work for a sidecar bridge, but the bridge needs a clear event forwarding model.

Recommended follow-up:

- keep SDK progress callback semantics
- bridge transport may expose polling, SSE, or request-scoped events
- do not make transport event shape the SDK contract

## No Immediate Refactor Needed

The audit does not find a severe layering violation.

No lower-level runtime capability needs to be extracted from CLI before a Tauri shell boundary can be planned. The main work is to make already-existing AppRuntime capabilities more granular and shell-friendly.

## Recommended Next Implementation Work

Create a focused implementation work unit:

```text
Runtime SDK Watch and Shell Status Boundary
```

Primary goals:

- add explicit watch lifecycle/status operations
- add read-only config info if needed by shell status
- enrich MCP access/setup status without adding MCP daemon lifecycle
- keep CLI thin by routing existing commands through the improved SDK
- prove with tests that CLI and future bridge can share AppRuntime operations

