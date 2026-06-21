# WU-01 Sidecar Bridge Contract Plan

## Goal

Define a protocol-neutral sidecar bridge contract over `AppRuntime` so future local HTTP, stdio, or Tauri IPC transports can share the same runtime semantics.

## Scope

In scope:

- shell bridge request/response contract
- bridge handler that dispatches to `AppRuntime`
- scan progress event capture
- watch start/stop mapped to explicit runtime SDK operations
- contract tests proving supported and unsupported operations
- boundary test proving the bridge does not import lower-level core modules

Out of scope:

- HTTP server
- Tauri app
- sidecar process launch
- config editing
- MCP admin lifecycle
- query playground

## Files

- Create: `src/interfaces/shell-bridge/contracts.ts`
- Create: `src/interfaces/shell-bridge/handler.ts`
- Create: `src/interfaces/shell-bridge/index.ts`
- Create: `src/interfaces/shell-bridge/handler.test.ts`
- Create: `src/interfaces/shell-bridge/boundary.test.ts`
- Modify: `docs/phases/p1-macos-menu-bar-shell/02_execution_index.md`

## Contract Shape

Supported bridge operations:

- `health`
- `status`
- `config`
- `sources.inspect`
- `scan`
- `watch.start`
- `watch.stop`

Explicitly not included:

- config editing
- query playground
- MCP start/stop
- arbitrary file access

## Steps

1. Write failing shell bridge handler tests.
2. Verify tests fail because `createShellBridgeHandler` does not exist.
3. Implement contract and handler.
4. Run focused shell bridge tests.
5. Add and run boundary test.
6. Update execution index.
7. Run `pnpm test`, `pnpm typecheck`, and `git diff --check`.

## Acceptance Criteria

- Bridge handler maps each supported operation to the expected `AppRuntime` method.
- `scan` captures progress events without defining a transport event protocol.
- `watch.start` and `watch.stop` use explicit watch SDK operations.
- Unsupported operations return a structured bridge error.
- The shell bridge imports app contracts only, not sources, processors, embeddings, storage, query, indexing, config, or CLI.
- No HTTP or Tauri implementation is added.
