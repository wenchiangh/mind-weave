# WU-04 Runtime And Index Status Panel

## Goal

Render the first read-only runtime and index status panel in the macOS shell.

## Scope

This work unit adds:

- app-side `/status` bridge client call
- a small status view model for the tray panel
- Runtime, Index, Sources, Provider, Storage, and Logs summaries
- unavailable/error state for status loading

This work unit does not add:

- scan trigger
- watch start/stop controls
- MCP setup actions
- path open actions
- config editing
- query playground

## Design

The shell should continue to depend only on the loopback shell bridge transport. It should not import CLI, AppRuntime, storage, indexer, or source modules.

The app-side flow is:

```text
main.ts
  -> readBridgeHealth()
  -> readRuntimeStatus()
  -> createShellPanelModel()
  -> renderShell()
```

The view model should translate bridge responses into compact display rows. It should avoid embedding business logic about indexing correctness; it only reflects what the runtime reports.

## Tests

Test-first implementation should cover:

- app bridge client calls `/status`
- status client reports unavailable when fetch fails
- status client reports unavailable when bridge returns a structured error
- status view model includes runtime availability, provider readiness, document counts, chunk count, embedding count, storage path, log path, and source summaries
- app boundary still does not import CLI or core modules directly

## Acceptance

- `pnpm vitest run apps/macos-shell/src/bridge-client.test.ts apps/macos-shell/src/status-model.test.ts apps/macos-shell/src/boundary.test.ts` passes.
- `pnpm --dir apps/macos-shell build` passes.
- `pnpm typecheck` passes.
- Runtime and index status are rendered from bridge data, not from direct core imports.
