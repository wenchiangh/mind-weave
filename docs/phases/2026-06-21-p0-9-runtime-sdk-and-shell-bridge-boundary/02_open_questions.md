# P0.9 Decisions And Remaining Questions

This document tracks decisions made during P0.9 and the smaller questions that remain for later implementation phases.

## Resolved Decisions

## 1. Does AppRuntime Already Expose Enough SDK Surface?

Decision:

- mostly yes

Current CLI already routes status, inspect, scan, query, watch/start workflows, and MCP handler serving through `AppRuntime` or app-level helpers.

The main gap is not a severe layering violation. The main gap is that some runtime capabilities are too coarse for a future shell.

Follow-up:

- implement explicit watch lifecycle/status
- enrich read-only config info
- enrich MCP access/setup status

Reference:

- `04_runtime_sdk_surface_audit.md`

## 2. What Is The First Bridge Transport?

Decision:

- local HTTP bound to `127.0.0.1` is the first bridge transport candidate
- it should not be implemented before the Runtime SDK surface is tightened
- it is not the stable core contract

Reference:

- `06_bridge_transport_decision.md`

## 3. What Does MCP Status Mean In A Stdio World?

Decision:

- the shell should describe MCP access/setup/status, not MCP daemon running state
- `startMcp` and `stopMcp` remain deferred
- current stdio MCP should stay agent-launched and serve-only

Follow-up:

- enrich runtime status or add SDK info for MCP access/setup

## 4. Should Config Editing Stay Deferred Through The First Tauri Shell?

Decision:

- yes

The first shell should show read-only effective config information and provide open-config-file/folder actions. It should not add source editing, config hot reload, provider key management, or model management.

## 5. Should Watch Be The First-Class Long-Running Control?

Decision:

- yes

Watch should be independently controllable and observable. Scan remains one-shot. Embedding appears through provider readiness, scan progress, and indexing failures. MCP access remains separate from watch status.

## Remaining Questions

## 1. Exact Watch Status Shape

The next implementation work should choose the exact AppRuntime contract shape for watch status.

Expected concepts:

- stopped
- starting
- running
- stopping
- error
- watcher count
- last error when available

## 2. Exact Config Info Shape

The next implementation work should decide whether config info is:

- part of `RuntimeStatus`
- a separate `getConfigInfo()` SDK operation
- both, with status carrying summary and `getConfigInfo()` carrying shell-focused detail

The first implementation should choose the smallest shape that supports the future shell without duplicating status data.

## 3. Progress Event Exposure For Bridge Transport

The Runtime SDK can keep callback-based scan progress.

The bridge transport still needs a later choice:

- polling
- request-scoped progress messages
- SSE
- WebSocket

This should be decided during the local HTTP bridge spike, not during Runtime SDK tightening.

## 4. Local HTTP Bridge Security Details

The transport decision already requires loopback-only binding.

The bridge spike should later decide:

- fixed or dynamic port
- discovery mechanism
- whether to use a local token
- how Tauri learns the bridge URL
- how to avoid leaking secrets in responses

