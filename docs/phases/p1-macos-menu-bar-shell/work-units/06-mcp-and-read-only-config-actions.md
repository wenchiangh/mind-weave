# WU-06 MCP And Read-Only Config Actions

## Goal

Expose MCP connection information and read-only local path actions from the tray panel.

## Scope

This work unit adds:

- MCP status and setup command display
- config path display
- source root display
- copy MCP setup command action
- open config/log/source path actions

This work unit does not add:

- config editing
- MCP daemon lifecycle
- MCP session manager
- full log viewer
- source add/remove UI

## Design

These are shell adapter actions. The shell may copy text or open local paths, but it should not mutate MindWeave config or manage MCP runtime lifecycle.

The app flow remains:

```text
runtime status from bridge
  -> panel model
  -> read-only display rows
  -> shell-owned copy/open callbacks
```

## Tests

Test-first implementation should cover:

- panel model includes MCP transport/setup command
- panel model includes config, log, and first source path details
- file path helper converts local paths to `file://` URLs
- app boundary still does not import CLI or core modules directly

## Acceptance

- `pnpm vitest run apps/macos-shell/src/status-model.test.ts apps/macos-shell/src/platform-actions.test.ts apps/macos-shell/src/boundary.test.ts` passes.
- `pnpm --dir apps/macos-shell build` passes.
- `pnpm typecheck` passes.
- Actions are read-only shell actions and do not edit config.
