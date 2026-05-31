# P1 macOS Tauri Shell Direction

This document is a lightweight direction note for the future macOS product shell. It is intentionally not a full spec yet.

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

The exact communication mechanism should be decided after Core exposes enough lifecycle, status, and configuration behavior to evaluate the trade-offs.

## Core Dependency

P1 depends on Core decisions from P0:

- Configuration format.
- Effective config model.
- Source status model.
- Document/index status model.
- Log file location.
- Core start/stop behavior.
- MCP server lifecycle.
- Whether Core exposes a local control API.

These should not be guessed too early. The shell should adapt to the validated Core shape.

## Initial UI Surface

The first UI should stay small:

- Tray menu.
- Source list.
- Index status summary.
- Add/remove/disable source controls.
- Open file action where a source path is available.
- Open logs action.
- Basic error indicator.

Manual query playground and chunk preview are not part of the initial shell direction. They may be reconsidered after the agent-facing query loop is validated.

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
- Source configuration flow.
- Tray behavior.
- Error and log presentation.
- macOS distribution assumptions.
