# WU-03 Tauri Shell Skeleton And Sidecar Launch

## Goal

Create the first macOS shell skeleton and the sidecar entrypoint it depends on, without adding runtime/index UI behavior that belongs to later work units.

## Scope

This work unit adds:

- a Node.js shell bridge server entrypoint
- a minimal app-side bridge client
- a minimal Tauri/Vite app folder
- a compact tray-panel-like web surface that can show bridge health
- tests proving the sidecar entrypoint and bridge client behavior

This work unit does not add:

- status panel details
- scan/watch controls
- MCP actions
- config editing
- query playground
- packaged production sidecar binary

## Design

The Tauri shell is an app adapter. It does not depend on CLI commands and does not import core modules directly.

The dependency chain remains:

```text
macOS shell UI
  -> app bridge client
  -> loopback shell bridge transport
  -> shell bridge handler
  -> AppRuntime
```

The sidecar entrypoint owns the concrete process behavior:

```text
sidecar process
  -> parse --config/--host/--port
  -> create AppRuntime from config
  -> create shell bridge handler
  -> create loopback HTTP bridge server
  -> keep process alive until SIGINT/SIGTERM
```

The first Tauri skeleton may connect to an already running local bridge in development. Bundled sidecar packaging is documented in the Tauri config skeleton but can be hardened after the UI surface is proven.

## Implementation Notes

- Keep the sidecar server under `src/interfaces/shell-bridge` because it is an interface adapter.
- Keep the app shell under `apps/macos-shell` because it is not core and should remain replaceable by other future shells.
- Use plain TypeScript for the first panel to avoid adding a UI framework before the MVP surface proves it needs one.
- Bind the bridge server to `127.0.0.1` by default.
- Let the app bridge URL be configurable through a local constant or environment value so future sidecar port negotiation can replace it without rewriting UI logic.
- Tauri v2 sidecar packaging expects external binaries to be declared in `tauri.conf.json`, but this work unit does not package a production sidecar binary. The skeleton should connect to a running local bridge in development and defer `externalBin` until the binary build step exists.

## Tests

Test-first implementation should cover:

- sidecar serve args parse `--config`, optional `--host`, and optional `--port`
- missing `--config` returns a structured usage failure
- non-loopback host is rejected by the existing HTTP bridge guard
- sidecar runner creates runtime, handler, and HTTP server through dependency injection
- app bridge client calls `/health`
- app bridge client returns an unavailable result when the bridge request fails
- app shell boundary does not import CLI or core modules directly
- Tauri config does not declare `externalBin` before a real sidecar binary build step exists

## Acceptance

- `pnpm vitest run src/interfaces/shell-bridge/server-main.test.ts apps/macos-shell/src/bridge-client.test.ts apps/macos-shell/src/boundary.test.ts` passes.
- `pnpm typecheck` passes.
- `apps/macos-shell` contains a minimal Tauri/Vite skeleton.
- The app-facing code talks only to the bridge client.
- The sidecar entrypoint is testable without launching Tauri.
- Tauri config can pass Rust-side validation without requiring a missing sidecar binary.

## Validation Notes

- `cargo check` validates the Rust/Tauri skeleton.
- `pnpm --dir apps/macos-shell build` validates the Vite shell.
- `pnpm --dir apps/macos-shell exec tauri --version` is currently blocked by npm registry timeout while fetching `@tauri-apps/cli-darwin-arm64`. This is a local dependency installation issue, not a Rust skeleton failure.
