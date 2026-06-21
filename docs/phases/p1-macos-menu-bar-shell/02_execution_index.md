# P1 macOS Menu Bar Shell Execution Index

This document tracks P1 as a single app milestone with recoverable work units.

## Status Model

- `planned`: work unit is listed but not planned in detail
- `plan-ready`: work unit has a detailed executable plan
- `implementing`: implementation is in progress
- `testing`: validation is in progress
- `passed`: implementation and validation are complete
- `blocked`: a decision is required
- `deferred`: intentionally postponed

## Execution Rules

- Execute one work unit at a time.
- Each work unit should produce an observable result.
- Each implementation work unit must use TDD.
- Keep detailed step lists inside the current work unit plan.
- Do not expand every future work unit into implementation detail upfront.
- Commit after each completed work unit unless directed otherwise.

## Work Units

## WU-00 App Shell Spec And Execution Index

- [x] Status: `passed`
- Scope:
  - Define the P1 app milestone.
  - Confirm menu bar / tray-first MVP.
  - Define UI MVP scope and non-goals.
  - Define recoverable work unit structure.
- Observable result:
  - `00_spec.md`
  - `01_mvp_scope.md`
  - `02_execution_index.md`

## WU-01 Sidecar Bridge Contract

- [x] Status: `passed`
- Scope:
  - Define the shell bridge contract over Runtime SDK semantics.
  - Keep transport replaceable.
  - Decide exact request/response shape for first bridge calls.
  - Decide event/progress strategy for scan.
- Observable result:
  - `work-units/01-sidecar-bridge-contract.md`
  - Protocol-neutral shell bridge contract and handler.
  - Contract tests prove supported operations, scan progress capture, watch controls, and structured errors.
  - Boundary tests prove the bridge does not import lower-level core modules or concrete transports.

## WU-02 Local HTTP Bridge Spike

- [x] Status: `passed`
- Scope:
  - Implement a thin local HTTP bridge over AppRuntime.
  - Bind only to `127.0.0.1`.
  - Expose health/status/config/inspect/scan/watch calls.
  - Do not expose config editing, MCP admin, or public API behavior.
- Observable result:
  - Tests prove HTTP routes call AppRuntime and contain no core business logic.
  - Local HTTP server binds to loopback only.
  - Unknown routes and invalid methods return structured JSON errors.
  - No Tauri implementation is added.

## WU-03 Tauri Shell Skeleton And Sidecar Launch

- [x] Status: `passed`
- Scope:
  - Create the minimal Tauri menu bar app shell.
  - Launch or connect to Node.js sidecar.
  - Show sidecar/core availability.
- Observable result:
  - macOS tray app opens a compact panel and reads bridge health.
  - `work-units/03-tauri-shell-skeleton-and-sidecar-launch.md`
  - Node sidecar bridge server entrypoint exists.
  - App shell bridge client reads sidecar health without importing core or CLI modules.

## WU-04 Runtime And Index Status Panel

- [x] Status: `passed`
- Scope:
  - Render runtime status, provider readiness, config/log paths, index counts, and source summaries.
- Observable result:
  - Tray panel can explain whether MindWeave is indexed and healthy.
  - `work-units/04-runtime-and-index-status-panel.md`
  - App bridge client reads `/status`.
  - Panel view model summarizes runtime, provider, index, storage, logs, and sources.

## WU-05 Scan And Watch Controls

- [x] Status: `passed`
- Scope:
  - Add scan trigger/progress.
  - Add watch start/stop/status.
  - Show watch errors.
- Observable result:
  - User can manually scan and control file watching from the tray panel.
  - `work-units/05-scan-and-watch-controls.md`
  - App bridge client can trigger scan and watch commands.
  - Panel model displays watch status and watcher count.

## WU-06 MCP And Read-Only Config Actions

- [x] Status: `passed`
- Scope:
  - Show MCP setup/status.
  - Copy MCP setup command.
  - Open config file/folder.
  - Open logs folder.
  - Open source root.
- Observable result:
  - User can connect agents and reach local diagnostic/config paths without editing config in-app.
  - `work-units/06-mcp-and-read-only-config-actions.md`
  - Panel model displays MCP setup, config path, log path, and source path.
  - Shell exposes copy/open callbacks without config editing.

## WU-07 Local Dogfooding Validation

- [x] Status: `passed`
- Scope:
  - Test the shell against the real local vault workflow.
  - Validate sidecar startup, status, scan, watch, MCP setup, and open-path actions.
  - Record UX gaps.
- Observable result:
  - Dogfooding notes and validation result are recorded before expanding UI scope.
  - `work-units/07-local-dogfooding-validation.md`

## Deferred

- source editing
- config hot reload
- query playground
- chunk preview
- full log viewer
- MCP daemon lifecycle
- login item / auto-start
- system notifications
