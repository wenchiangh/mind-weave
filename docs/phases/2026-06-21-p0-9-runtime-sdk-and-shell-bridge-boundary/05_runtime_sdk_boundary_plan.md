# Runtime SDK Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development before implementation. This plan must be implemented with failing tests first for every runtime behavior change.

**Goal:** Tighten the protocol-neutral Runtime SDK / AppRuntime surface so CLI and a future Tauri sidecar bridge can share runtime control behavior without depending on each other.

**Architecture:** Keep reusable runtime operations in `src/app`. Keep CLI parsing and output in `src/interfaces/cli`. Do not implement HTTP, Tauri, or a bridge transport in this work unit.

**Tech Stack:** TypeScript, Vitest, existing AppRuntime, existing CLI adapter tests.

---

## Scope

In scope:

- explicit watch lifecycle/status operations
- read-only config/runtime path information for shell display
- richer MCP access/setup status for the current stdio model
- CLI routing updates if existing commands should use more explicit SDK operations
- tests proving CLI remains a thin adapter

Out of scope:

- HTTP bridge
- Tauri shell
- config editing
- config hot reload
- MCP daemon start/stop
- query playground
- chunk preview

## Required TDD Rule

For every behavior change:

1. Add or update a focused test first.
2. Run the test and confirm it fails for the expected reason.
3. Implement the smallest runtime change.
4. Run the focused test until it passes.
5. Run full `pnpm test`, `pnpm typecheck`, and `git diff --check` before completion.

## Work Units

## WU-01 Watch Status Contract

Goal:

- add protocol-neutral watch lifecycle state to AppRuntime contracts.

Expected design:

- represent watch status separately from MCP status
- include states such as `stopped`, `starting`, `running`, `stopping`, and `error`
- include watcher count and last error if available

Validation:

- app/runtime tests prove a fresh runtime reports watch stopped
- starting watch changes status to running
- stopping watch changes status to stopped
- watcher start failure reports error without changing MCP status

## WU-02 Explicit Watch Operations

Goal:

- split watch control from the current coarse `start()` workflow.

Expected design:

- add explicit SDK operations for starting and stopping watchers
- keep one-shot `scan()` independent
- keep `start()` as a convenience workflow only if it remains useful
- update CLI `watch` to use explicit watch behavior if appropriate

Validation:

- tests prove `watch` command starts watchers without serving MCP
- tests prove scan can run without watch
- tests prove MCP can be served without starting watch

## WU-03 Read-Only Config Info

Goal:

- expose shell-useful config information without config editing.

Expected design:

- include config path when runtime was created from a config file
- include storage path and log path
- include effective source summaries
- include provider summary without secrets

Validation:

- runtime tests prove config info contains paths and sanitized provider data
- CLI tests do not need a new command unless current status output already covers the shell needs

## WU-04 MCP Access Info

Goal:

- describe MCP availability/setup in the current stdio model.

Expected design:

- distinguish MCP config enabled/disabled from MCP daemon running
- expose stdio command/setup information if available
- avoid `startMcp` / `stopMcp` operations in this work unit

Validation:

- runtime status tests prove MCP access info is separate from watch status
- MCP command tests continue proving `mcp` is serve-only and does not scan/watch

## WU-05 CLI Boundary Regression

Goal:

- ensure CLI remains a human control adapter over AppRuntime.

Expected design:

- CLI keeps parsing, JSON formatting, and exit code behavior
- CLI does not import source, processor, embedding, storage, query, indexing, or config modules

Validation:

- existing CLI boundary test remains green
- any new CLI command behavior is tested through fake AppRuntime

## Completion Criteria

- `pnpm test` passes
- `pnpm typecheck` passes
- `git diff --check` passes
- docs update the P0.9 execution index
- no HTTP/Tauri bridge implementation is added in this work unit

## Execution Result

Status:

- implemented and validated

Implemented:

- AppRuntime watch lifecycle/status boundary
- read-only runtime config info
- richer MCP access/setup status for stdio mode
- CLI `watch` routed through explicit watch SDK operation

Not implemented:

- HTTP bridge
- Tauri shell
- config editing
- MCP daemon start/stop
