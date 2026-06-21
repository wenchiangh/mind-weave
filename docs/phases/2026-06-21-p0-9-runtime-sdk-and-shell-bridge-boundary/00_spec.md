# P0.9 Runtime SDK and Shell Bridge Boundary Spec

## Purpose

P0.9 defines the boundary between MindWeave Core and future local product shells.

The immediate motivation is the future macOS Tauri Shell. Tauri cannot naturally call the TypeScript Core runtime directly, so the shell will need a Node.js sidecar bridge. This phase should prevent that bridge from becoming the architecture center.

The stable abstraction should remain a TypeScript runtime SDK / `AppRuntime` contract. Shell bridge transports such as local HTTP, stdio JSON-RPC, or platform IPC are adapters over that SDK.

## Product Context

MindWeave is a local-first knowledge connector for agents.

The core product value is:

```text
local knowledge
  -> indexed semantic chunks
  -> agent-accessible retrieval
```

The macOS app should make the local runtime easier to observe and control. It should not become the main knowledge consumption experience, and it should not turn Core into a public API server.

## Current Architectural Correction

Earlier architecture language treated CLI, Tauri, MCP, HTTP, and future adapters as similar interface adapters over Core. That is directionally useful but too coarse.

P0.9 refines the model:

```text
MindWeave Core
  - TypeScript Runtime SDK / AppRuntime
  - source / indexing / processor / embedding / storage / query modules
  - agent access adapter: MCP

Apps / Human Control Surfaces
  - CLI
  - macOS Tauri Shell
      - Tauri UI / tray
      - Node.js sidecar bridge
      - macOS platform actions
```

CLI and Tauri are human control surfaces. MCP is an agent access surface. They should not be discussed as one flat adapter category.

## Boundary Principles

### Core Exposes A Programmatic SDK

Core should expose protocol-neutral runtime operations through TypeScript contracts.

These operations are callable by:

- CLI directly
- Node.js sidecar bridge directly
- tests directly
- future local shells when they run in a compatible JS runtime

The SDK should not know whether the caller is CLI, Tauri, HTTP, stdio, or test code.

### Tauri Bridge Is A Shell Adapter

The Node.js sidecar bridge belongs to the macOS shell, not to Core domain logic.

It may import and call the Core runtime SDK, then expose a local bridge protocol to Tauri. That bridge protocol is an implementation detail of the shell boundary.

### HTTP Is Not The Core Contract

Local HTTP may be a useful first bridge transport, but it must not become the stable product architecture.

The stable contract is:

```text
Runtime SDK semantics
```

not:

```text
HTTP routes
```

HTTP route handlers, if added, should be thin:

- validate request shape
- call runtime SDK operations
- serialize response
- forward progress/events

They should not implement source scanning, indexing, query, embedding, config validation, or storage behavior.

### CLI Does Not Back Tauri

Tauri must not call CLI commands for core functionality.

If functionality exists only in CLI but is also needed by Tauri, the reusable part should move to the Runtime SDK / AppRuntime layer. CLI should keep command parsing, output formatting, and exit behavior only.

### MCP Remains Agent Access

MCP is the agent-facing retrieval/access surface.

It should continue to expose retrieval-oriented tools such as `search_knowledge` and `list_sources`. It should not become the default runtime administration surface.

Human control surfaces may display MCP setup/status information, but should not route general app administration through MCP.

## P0.9 Scope

P0.9 is a boundary and planning phase before P1 Tauri implementation.

In scope:

- define Runtime SDK / AppRuntime capability categories
- identify which current CLI behaviors already use AppRuntime correctly
- identify any CLI-only reusable logic that should move into runtime/app contracts
- define the Tauri sidecar bridge as a shell adapter
- define first-version bridge transport criteria
- separate human control surfaces from MCP agent access
- define first P1 shell dependency surface
- update P1 direction to reflect this refined architecture

Out of scope:

- implementing Tauri
- implementing source configuration editing UI
- implementing a public HTTP API
- making Core depend on HTTP
- turning MCP into an admin API
- adding query playground or chunk preview
- implementing a full background daemon/service model
- changing retrieval ranking or indexing behavior

## First P1 Shell Capability Target

The first macOS shell should prioritize observation and control of the local runtime, not configuration editing.

Target capabilities:

- display runtime health
- display effective config path and read-only config summary
- display configured sources
- inspect source include/exclude behavior
- display index stats
- display provider readiness
- trigger one-shot scan
- show scan progress
- start/stop/watch status for filesystem watching
- display MCP access/setup/status
- display log path and open log folder
- open config file or config folder
- open source file/folder when a path or URI is available

Deferred capabilities:

- source add/remove/disable UI
- config hot reload
- query playground
- chunk preview
- source document preview
- graph retrieval
- full log viewer
- model/provider management UI

## Long-Running Capability Model

The two runtime concerns that need long-running state are:

- file watching / indexing convergence
- agent access availability through MCP setup/status or future MCP serving modes

They should be represented separately.

File watching:

- is controlled by human surfaces
- can start/stop independently
- feeds index jobs through existing indexing flow
- can fail without making existing query over the latest index impossible

MCP access:

- is agent-facing
- should expose setup/status to human surfaces
- should not default to app administration
- may remain stdio command based in the near term

One-shot scan is not a long-running capability. Embedding is an indexing dependency and should appear through provider readiness, scan progress, job status, and failures.

## Bridge Transport Direction

P0.9 should not lock the project to HTTP.

Candidate transports:

- local HTTP bound to `127.0.0.1`
- stdio JSON-RPC between Tauri and Node sidecar
- Tauri invoke wrapper around sidecar calls
- future platform-specific IPC

First-version local HTTP is acceptable only if:

- it is documented as a shell bridge transport
- it binds to loopback only
- it is not called a public API
- route handlers stay thin
- Runtime SDK semantics remain protocol-neutral
- future transport replacement would not require rewriting source/index/query/core logic

## Success Criteria

P0.9 is successful when:

- the project has a written boundary model for Core, CLI, Tauri shell, sidecar bridge, and MCP
- the first P1 shell dependency surface is explicit
- config editing is intentionally deferred
- watch and MCP are modeled as separate concerns
- HTTP is treated as a replaceable bridge transport, not the core architecture
- remaining open decisions are recorded before implementation planning

