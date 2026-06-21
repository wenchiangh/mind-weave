# P1 macOS Menu Bar Shell MVP Scope

## MVP Definition

The MVP is a macOS menu bar utility for observing and controlling MindWeave's local runtime.

It is not a standalone knowledge browser.

## Included

## Menu Bar Presence

- tray/menu bar icon
- popover or compact panel
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
- provider/model/baseUrl/apiKeyEnv
- API key presence

## Logs And Paths

- open logs folder
- open source root

## Excluded

- main window
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
