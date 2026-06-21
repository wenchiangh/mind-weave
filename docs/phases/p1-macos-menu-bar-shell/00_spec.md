# P1 macOS Menu Bar Shell Spec

## Purpose

P1 builds the first local app shell for MindWeave.

The shell should make the local runtime visible and controllable from macOS without turning MindWeave into a chat app, a note browser, or a configuration management UI.

The first shell is a menu bar utility:

```text
macOS menu bar app
  -> tray icon
  -> compact popover/panel
  -> Node.js sidecar bridge
  -> MindWeave Runtime SDK
```

No separate main window is required for the MVP.

The intended macOS interaction model is a ClashBar-style menu bar panel:

- the app lives in the menu bar, not the Dock
- the panel is hidden by default
- clicking the menu bar icon toggles the panel
- the panel appears as a compact utility surface, not a normal document window
- the panel has no title bar or traffic-light controls
- the panel hides when it loses focus

A normal visible window may be used temporarily during development diagnostics, but it is not the product shell shape and should not be the acceptance behavior.

## Product Role

The P1 shell is a human control surface.

It helps the user answer:

- Is MindWeave running?
- Is my index healthy?
- Is file watching active?
- Can agents connect through MCP?
- Can I trigger a scan?
- Where are config and logs?

It should not become the primary knowledge consumption surface. Agents remain the primary runtime consumers.

## Architecture

P1 builds on the P0.9 boundary decision:

```text
Core Runtime SDK / AppRuntime
  -> used by CLI
  -> used by Node.js sidecar bridge

macOS menu bar shell
  -> owns Tauri UI / tray / platform actions
  -> owns sidecar lifecycle
  -> talks to the sidecar through a local bridge transport

MCP
  -> remains agent access
  -> is not the app administration API
```

The stable dependency is the Runtime SDK semantics, not CLI commands and not HTTP route shape.

Local HTTP bound to `127.0.0.1` is acceptable as the first sidecar bridge transport candidate, but it is a shell bridge adapter, not a public API.

## MVP UI Surface

The MVP should use a single compact tray panel.

The panel should behave like a menu bar utility panel rather than a main app window. It should be suitable for quick status checks and short control actions, then get out of the way.

Suggested sections:

- Runtime
- Index
- Watch
- Scan
- MCP
- Actions

The panel may use compact rows, small status badges, and collapsible sections if needed. It should not introduce multi-page navigation in the MVP.

Window-level requirements:

- use accessory-style app activation on macOS so the shell does not show as a regular Dock app
- keep the panel hidden on launch
- show or hide the panel from the menu bar icon
- position the panel near the menu bar icon when tray event geometry is available
- use an undecorated, non-resizable, always-on-top utility surface with a shadow
- hide the panel on focus loss
- keep any development fallback behavior explicitly separate from the product interaction model

## MVP Capabilities

### Runtime Summary

Show:

- runtime availability
- sidecar availability
- storage path summary
- log path summary
- provider readiness
- compact error indicator

If the sidecar or runtime is unavailable, show:

- `Core unavailable`
- retry action
- open logs action when possible
- quit action

### Index Summary

Show:

- source count
- indexed/stale/failed/deleted document counts
- chunk count
- embedding count
- concise per-source status

For sources:

- if source count is small, show source names and root paths
- if there are many sources, show the first few and a `+N more` summary

### Scan Control

Support:

- trigger one-shot scan
- show scanning state
- show coarse progress
- show final success/failure

Do not show a detailed file event timeline in the MVP.

### Watch Control

Support:

- show watch status
- start watch
- stop watch
- show watcher count
- show last watch error

Watch is the first long-running control capability in the shell.

### MCP Access

Show:

- MCP enabled/disabled
- transport: stdio
- setup command availability
- copy setup command action

Do not add MCP daemon start/stop in the MVP.

### Read-Only Config

Show:

- config path
- effective sources summary
- provider/model/baseUrl/apiKey or apiKeyEnv
- API key present/missing

Actions:

- open config file
- open config folder

Do not edit config in the MVP.

### Logs And Paths

Actions:

- open logs folder
- open source root
- open config file
- open config folder

These are platform actions owned by the shell.

## Non-Goals

The P1 MVP should not include:

- separate main window
- source add/remove/disable UI
- config editing
- config hot reload
- query playground
- manual search
- chat
- chunk preview
- document preview
- graph view
- full log viewer
- MCP session manager
- MCP daemon lifecycle
- model/provider management UI
- startup item / login item
- system notifications
- background service installer

## Work Structure

P1 should be implemented as one app milestone with multiple recoverable work units.

Use this hierarchy:

```text
Phase / Milestone
  -> Work Unit
      -> Steps
```

Work units should be large enough to produce stable observable app capability, but small enough to interrupt and resume.

Detailed implementation steps should live in the current work unit plan, not all be expanded upfront.

## Success Criteria

P1 MVP is successful when:

- the menu bar shell can launch or connect to a Node.js sidecar
- the shell can read runtime status through the bridge
- the tray panel shows runtime, index, watch, scan, MCP, config, and log status
- the user can trigger scan
- the user can start/stop watch
- the user can copy MCP setup command
- the user can open config/log/source paths
- no config editing or query playground is included
- the shell behaves as a menu bar panel rather than a regular macOS main window
- the app can be dogfooded against the existing local vault workflow
