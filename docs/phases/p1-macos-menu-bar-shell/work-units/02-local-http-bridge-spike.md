# WU-02 Local HTTP Bridge Spike Plan

## Goal

Implement a thin local HTTP bridge transport over the protocol-neutral shell bridge handler.

## Scope

In scope:

- local HTTP server factory
- loopback-only listen guard
- route-to-shell-bridge operation mapping
- JSON response serialization
- basic method validation
- tests proving routes call the shell bridge, not AppRuntime directly

Out of scope:

- Tauri app
- sidecar process packaging
- config editing
- public API behavior
- auth/token scheme
- SSE/WebSocket progress stream
- MCP admin lifecycle

## Files

- Create: `src/interfaces/shell-bridge/http-server.ts`
- Create: `src/interfaces/shell-bridge/http-server.test.ts`
- Modify: `src/interfaces/shell-bridge/index.ts`
- Modify: `docs/phases/p1-macos-menu-bar-shell/02_execution_index.md`

## Initial Routes

- `GET /health` -> `health`
- `GET /status` -> `status`
- `GET /config` -> `config`
- `GET /sources/inspect` -> `sources.inspect`
- `POST /scan` -> `scan`
- `POST /watch/start` -> `watch.start`
- `POST /watch/stop` -> `watch.stop`

## Steps

1. Write failing HTTP bridge route tests.
2. Verify tests fail because HTTP bridge server does not exist.
3. Implement the smallest Node `http` based bridge server.
4. Run focused HTTP bridge tests.
5. Add loopback binding tests.
6. Run full verification.

## Acceptance Criteria

- Server can be started on `127.0.0.1`.
- Non-loopback host is rejected.
- Routes map to shell bridge operations.
- Unsupported route returns `404` JSON.
- Wrong method returns `405` JSON.
- Route handler does not import AppRuntime or lower-level core modules.
- No Tauri or public API behavior is added.
