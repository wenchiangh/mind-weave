# WU-07 Local Dogfooding Validation

## Goal

Validate the P1 menu bar shell work against the current local MindWeave configuration before expanding UI scope.

## Scope

This work unit records:

- bridge startup against the real local config
- health/status bridge responses
- app shell build result
- Rust/Tauri skeleton check result
- remaining local environment gaps

It does not add new product behavior.

## Validation Environment

- Config: `/Users/wenchiangh/.config/mindweave/config.json`
- Storage: `/Users/wenchiangh/.config/mindweave/mindweave.sqlite`
- Shell bridge: loopback HTTP server on ephemeral port

## Commands

### Bridge Dogfooding

Command shape:

```bash
pnpm tsx -e '<start runShellBridgeServer with local config, fetch /health and /status, stop>'
```

Observed summary:

```json
{
  "health": {
    "ok": true,
    "operation": "health",
    "result": {
      "name": "mind-weave-core",
      "status": "ok"
    }
  },
  "statusSummary": {
    "ok": true,
    "operation": "status",
    "sourceCount": 1,
    "documents": {
      "indexed": 73,
      "stale": 0,
      "failed": 0,
      "deleted": 0
    },
    "chunks": 620,
    "embeddings": 620,
    "watch": {
      "status": "stopped",
      "watcherCount": 0
    },
    "mcp": {
      "enabled": true,
      "access": "available",
      "transport": "stdio",
      "startStopSupported": false,
      "setupCommand": "mindweave mcp --config /Users/wenchiangh/.config/mindweave/config.json"
    }
  }
}
```

### Automated Validation

Commands:

```bash
pnpm vitest run src/interfaces/shell-bridge/server-main.test.ts apps/macos-shell/src/bridge-client.test.ts apps/macos-shell/src/status-model.test.ts apps/macos-shell/src/platform-actions.test.ts apps/macos-shell/src/boundary.test.ts apps/macos-shell/src-tauri/tauri-config.test.ts
pnpm --dir apps/macos-shell build
pnpm typecheck
cargo check
```

## Result

The P1 shell bridge and app skeleton are usable enough to continue:

- the sidecar bridge can start against the real local config
- `/health` and `/status` return data needed by the panel
- the app shell can build with Vite
- the Rust/Tauri skeleton passes `cargo check`
- the UI remains an adapter over the bridge, not a direct core or CLI consumer

## Remaining Gaps

- `pnpm --dir apps/macos-shell exec tauri --version` is still affected by the local npm optional dependency state for `@tauri-apps/cli-darwin-arm64`. `cargo check` validates the Rust skeleton independently.
- The panel has not yet been visually verified inside a running Tauri tray window.
- Sidecar production packaging is still intentionally deferred.
- There is no automatic status refresh loop yet.
