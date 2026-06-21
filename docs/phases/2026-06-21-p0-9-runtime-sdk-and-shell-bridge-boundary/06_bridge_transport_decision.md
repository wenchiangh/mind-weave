# Shell Bridge Transport Decision

## Purpose

This document records the first bridge transport direction for the future macOS Tauri Shell.

It does not define a public API. It defines how a Tauri shell may communicate with a Node.js sidecar that imports the Runtime SDK.

## Decision

The first bridge transport candidate is:

```text
local HTTP bound to 127.0.0.1
```

This is a pragmatic first bridge transport, not the stable architecture.

The stable abstraction remains:

```text
Runtime SDK / AppRuntime semantics
```

## Why Local HTTP Is Acceptable First

Local HTTP is useful for the first sidecar bridge because it is:

- easy to test without a full Tauri app
- easy to inspect during development
- suitable for status and command-style calls
- compatible with future event streaming if needed
- simple for frontend code to call

## Constraints

If implemented, the local HTTP bridge must:

- bind only to loopback
- not be advertised as a public API
- not be used by Core as its stable contract
- keep route handlers thin
- delegate business behavior to AppRuntime
- avoid exposing secrets
- avoid exposing config editing in the first shell phase
- keep MCP agent access separate

## Non-Goals

The first bridge transport should not:

- implement source scanning itself
- implement indexing itself
- implement query ranking itself
- expose general runtime administration through MCP
- define a cloud or remote API
- require Tauri UI to call CLI commands

## Alternatives Considered

### Stdio JSON-RPC

Pros:

- no port
- private parent/child process model
- natural sidecar lifecycle binding

Cons:

- harder to debug
- event multiplexing needs more care
- less convenient for early status/control testing

### Tauri-Specific IPC Wrapper

Pros:

- can feel more native to the final app
- may reduce exposed local surface

Cons:

- harder to validate before Tauri implementation
- risks coupling Runtime SDK planning to Tauri-specific details too early

### Platform IPC

Pros:

- potentially strongest local-app fit

Cons:

- premature for the current project stage
- more packaging and platform work

## Event Model Direction

The SDK should keep scan progress as protocol-neutral runtime events or callbacks.

The bridge transport can later choose:

- polling
- request-scoped progress responses
- SSE
- WebSocket
- another app-local event channel

Do not define transport event shape as the Runtime SDK contract.

## Implementation Timing

Do not implement the local HTTP bridge before tightening the Runtime SDK/AppRuntime surface.

Recommended order:

1. Runtime SDK watch/status/config/MCP access boundary
2. local HTTP bridge spike
3. P1 Tauri shell spec
4. Tauri implementation

