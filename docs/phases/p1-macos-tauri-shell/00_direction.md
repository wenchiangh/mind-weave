# P1 macOS Tauri Shell Direction

This document is a lightweight direction note for the future macOS product shell. It is intentionally not a full spec yet.

Superseded for MVP planning by:

- `../p1-macos-menu-bar-shell/00_spec.md`
- `../p1-macos-menu-bar-shell/01_mvp_scope.md`
- `../p1-macos-menu-bar-shell/02_execution_index.md`

The P1 shell should be designed after the P0 Core MVP proves the indexing and MCP retrieval loop.

## Purpose

The macOS shell should make MindWeave easier to run, configure, and observe.

It should not own the core indexing or query logic. It should be an interface adapter over MindWeave Core.

## Product Role

The shell is a taskbar app for local users.

Its role is to provide:

- Source configuration.
- Source and index status.
- Basic error visibility.
- Open source file actions.
- Open log folder actions.
- Core runtime start/connect behavior.

It should not become the main knowledge consumption experience. Agents remain the primary runtime consumers.

## Runtime Direction

The expected model is:

```text
Tauri taskbar app
  -> starts or connects to Node.js sidecar
  -> Node.js sidecar runs MindWeave Core
  -> Tauri UI communicates with Core through local IPC, HTTP, or stdio
```

The stable dependency should be the Core TypeScript Runtime SDK / AppRuntime contract, not a CLI command or an HTTP route contract. The Node.js sidecar bridge belongs to the Tauri shell adapter layer and may expose local IPC, HTTP, or stdio to the Tauri frontend.

The exact communication mechanism should be decided after the Runtime SDK and shell bridge boundary are audited and documented.

## Core Dependency

P1 depends on Core decisions from P0:

- Configuration format.
- Effective config model.
- Source status model.
- Document/index status model.
- Log file location.
- Runtime SDK / AppRuntime operation surface.
- Core start/stop behavior.
- Watch start/stop/status behavior.
- MCP access/setup/status behavior.
- Sidecar bridge transport choice.

These should not be guessed too early. The shell should adapt to the validated Core shape.

The P0.9 boundary decision is:

- Core exposes a TypeScript Runtime SDK / AppRuntime surface.
- CLI imports that SDK directly.
- The macOS shell owns a Node.js sidecar bridge because Tauri cannot naturally call TypeScript Core in-process.
- Local HTTP is an acceptable first bridge transport candidate, but it is not the stable core contract.
- Source configuration editing remains deferred for the first shell.

## Initial UI Surface

The first UI should stay small:

- Tray menu.
- Source list.
- Index status summary.
- Read-only config summary.
- Open config file or folder.
- Scan trigger and progress display.
- Watch start/stop/status.
- MCP setup/status display.
- Open file action where a source path is available.
- Open logs action.
- Basic error indicator.

Source add/remove/disable controls, manual query playground, and chunk preview are not part of the initial shell direction. They may be reconsidered after the runtime shell boundary and first status/control shell are validated.

## Future Spec Trigger

Create a full P1 spec when the P0 Core MVP can:

- Load config.
- Index local Markdown sources.
- Store chunks and vectors.
- Serve MCP `search_knowledge`.
- Update index state after file changes.
- Report useful source/index status.
- Write logs that explain failures.

At that point, the P1 spec should define:

- Sidecar packaging.
- Tauri-to-Core communication.
- UI state model.
- Read-only config display and open-config actions.
- Tray behavior.
- Error and log presentation.
- macOS distribution assumptions.
