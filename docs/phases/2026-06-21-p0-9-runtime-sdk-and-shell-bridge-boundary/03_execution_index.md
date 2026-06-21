# P0.9 Runtime SDK and Shell Bridge Boundary Execution Index

This document tracks the boundary-definition phase before P1 Tauri Shell implementation.

## Status Legend

- `planned`: scope is recorded but not started
- `in_progress`: work has started
- `passed`: work and validation are complete
- `blocked`: a decision is required before continuing

## Work Units

## WU-00 Phase Definition

- [x] Status: `passed`
- Scope:
  - Define why this phase exists.
  - Establish that the stable abstraction is Runtime SDK/AppRuntime, not HTTP.
  - Establish that the Tauri sidecar bridge belongs to the shell adapter layer.
- Observable result:
  - `00_spec.md`
  - `01_boundary_design.md`
  - `02_open_questions.md`
  - `03_execution_index.md`

## WU-01 Runtime SDK Surface Audit

- [x] Status: `passed`
- Scope:
  - Audit `src/app` and `src/interfaces/cli`.
  - List current runtime operations available to CLI.
  - Identify CLI-only reusable logic that should move below CLI.
  - Identify missing operations needed by the first Tauri shell.
- Observable result:
  - `04_runtime_sdk_surface_audit.md`

## WU-02 Runtime SDK Boundary Plan

- [x] Status: `passed`
- Scope:
  - Create a work-unit plan for tightening the AppRuntime/SDK surface.
  - Keep the plan protocol-neutral.
  - Include TDD validation expectations.
- Observable result:
  - `05_runtime_sdk_boundary_plan.md`

## WU-03 Bridge Transport Decision

- [x] Status: `passed`
- Scope:
  - Compare local HTTP, stdio JSON-RPC, and Tauri-specific IPC for the sidecar bridge.
  - Decide whether to implement a local HTTP bridge spike.
  - Define local-only safety constraints if HTTP is selected.
- Observable result:
  - `06_bridge_transport_decision.md`

## WU-04 P1 Shell Dependency Update

- [x] Status: `passed`
- Scope:
  - Update the P1 Tauri direction after WU-01 through WU-03.
  - Keep config editing deferred unless a later decision changes it.
- Observable result:
  - P1 direction references the runtime SDK and sidecar bridge boundary.

## WU-05 Runtime SDK Watch And Shell Status Boundary

- [x] Status: `passed`
- Scope:
  - Add explicit watch lifecycle operations to AppRuntime.
  - Add watch status to runtime status.
  - Add read-only config info for shell adapters.
  - Enrich MCP status for the current stdio access model.
  - Route CLI watch through explicit watch SDK behavior.
  - Do not implement HTTP, Tauri, config editing, or MCP daemon lifecycle.
- Observable result:
  - AppRuntime exposes `getConfigInfo`, `startWatching`, and `stopWatching`.
  - Runtime status includes `config`, `watch`, and richer `mcp` access/setup status.
  - CLI remains a thin adapter over AppRuntime.
  - Tests and typecheck pass.
