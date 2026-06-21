# P1 macOS Menu Bar Shell MVP Scope

## MVP Definition

The MVP is a macOS menu bar utility for observing and controlling MindWeave's local runtime.

It is not a standalone knowledge browser.

## Included

## Menu Bar Presence

- tray/menu bar icon
- ClashBar-style popover or compact panel
- hidden Dock presence
- hidden-by-default panel
- tray icon click toggles panel visibility
- panel hides on focus loss
- undecorated utility panel without traffic-light controls
- quit action

## Runtime Status

- core availability
- sidecar availability
- provider readiness
- storage path
- log path
- compact error state

## Index Status

- source count
- document counts by status
- chunk count
- embedding count
- concise source list

## Scan

- scan action
- scanning state
- coarse progress
- final result
- failure message

## Watch

- watch status
- start watch
- stop watch
- watcher count
- last watch error

## MCP

- MCP enabled/disabled
- stdio transport
- setup command
- copy setup command

## Read-Only Config

- config path
- open config file
- open config folder
- effective source summary
- provider/model/baseUrl/apiKey or apiKeyEnv
- API key presence

## Logs And Paths

- open logs folder
- open source root

## Excluded

- main window
- Dock-first app behavior
- normal title-bar window behavior
- settings page
- source editing
- provider/model editing
- config hot reload
- query playground
- manual search
- chunk preview
- document preview
- full log viewer
- graph view
- MCP session manager
- MCP daemon start/stop
- login item / auto-start
- system notifications

## Design Bias

Prefer a compact, utilitarian control panel.

Avoid a marketing-style UI, oversized hero sections, card-heavy layouts, or a standalone knowledge-management feel. This shell should feel like a local runtime utility.

The MVP shell should feel like a menu bar control surface. If implementation needs a temporary visible window for debugging, that behavior should stay outside the accepted user experience.
