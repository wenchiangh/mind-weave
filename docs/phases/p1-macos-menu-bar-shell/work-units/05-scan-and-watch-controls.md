# WU-05 Scan And Watch Controls

## Goal

Add the first tray panel controls for one-shot scan and watch start/stop.

## Scope

This work unit adds:

- app-side bridge calls for `POST /scan`, `POST /watch/start`, and `POST /watch/stop`
- watch status display in the panel model
- scan/watch buttons in the shell panel
- simple action feedback after a scan/watch command

This work unit does not add:

- detailed scan timeline
- file event timeline
- automatic refresh loop
- notifications
- retry policy UI
- watcher implementation changes

## Design

Controls remain shell adapter behavior:

```text
button click
  -> app bridge client
  -> local HTTP bridge route
  -> shell bridge handler
  -> AppRuntime scan/watch method
```

The UI should only present command results returned by the bridge. It should not infer indexing correctness beyond runtime status.

## Tests

Test-first implementation should cover:

- scan client posts to `/scan`
- watch start client posts to `/watch/start`
- watch stop client posts to `/watch/stop`
- command client returns unavailable when the bridge returns a structured error
- status model includes watch status and watcher count
- app boundary still does not import CLI or core modules directly

## Acceptance

- `pnpm vitest run apps/macos-shell/src/bridge-client.test.ts apps/macos-shell/src/status-model.test.ts apps/macos-shell/src/boundary.test.ts` passes.
- `pnpm --dir apps/macos-shell build` passes.
- `pnpm typecheck` passes.
- Scan and watch controls are UI adapter behavior over the existing shell bridge.
