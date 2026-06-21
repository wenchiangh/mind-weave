# WU-08 Menu Bar Panel Behavior Hardening

## Goal

Make the macOS shell behave like a menu bar utility panel rather than a normal application window.

## Context

Local dogfooding exposed that the first Tauri shell can launch and read runtime status, but it appears as a normal macOS window with a title bar, traffic-light controls, and Dock-style presence. That is useful as a development fallback, but it is not the accepted P1 product shape.

The accepted interaction model is a ClashBar-style menu bar panel:

```text
menu bar icon
  -> click toggles compact panel
  -> panel shows runtime/status/control surface
  -> focus loss hides panel
```

## Scope

This work unit adds:

- accessory-style macOS activation so the shell is not Dock-first
- hidden-by-default panel window
- tray icon click toggling
- menu item toggling
- focus-loss hide behavior
- undecorated utility-panel Tauri window configuration
- tray-anchored panel positioning
- tests for the Tauri configuration and Rust-side behavior

This work unit does not add:

- source editing
- settings pages
- query playground
- native `NSPopover` implementation
- native `NSPanel` customization beyond what Tauri exposes
- final visual design polish

## Design

The shell should continue to be a Tauri adapter over the shell bridge. No Core, CLI, storage, indexing, or source modules should be imported by the app shell.

The first implementation should use the existing Tauri `WebviewWindow` as a simulated menu bar panel. A true native `NSPopover` or custom `NSPanel` can be revisited later if Tauri window behavior proves insufficient.

The app-level behavior should be:

```text
startup
  -> set macOS activation policy to Accessory
  -> create tray icon/menu
  -> leave main panel hidden

tray left click
  -> if panel visible: hide
  -> if panel hidden: show, unminimize, focus

panel focus lost
  -> hide panel
```

The Tauri window should be configured as:

- label: `main`
- visible: `false`
- decorations: `false`
- resizable: `false`
- alwaysOnTop: `true`
- skipTaskbar: `true`
- shadow: `true`
- width/height sized for compact panel usage

Positioning should use the tray event rectangle when available. The panel should horizontally align to the tray icon center and clamp to the current monitor work area so it does not drift far from the menu bar icon or off screen.

The panel should stay rectangular for now. CSS/WebView-based rounded corners looked visually off during dogfooding; native rounding can be revisited later with a true `NSPanel` or `NSPopover` approach.

## Tests

Test-first implementation should cover:

- Tauri config defines the main window as hidden by default.
- Tauri config defines an undecorated, non-resizable utility panel.
- Tauri config keeps the panel out of taskbar/Dock surfaces where supported by Tauri.
- Rust shell setup sets `ActivationPolicy::Accessory`.
- Tray click and `Show Panel` menu path call a shared toggle function.
- The shared toggle function can hide a visible panel and show/focus a hidden panel.
- Tray click passes the tray rectangle into panel positioning before showing.
- Focus loss hides the panel.
- CSS keeps the panel rectangular until native rounding is implemented.
- Existing bridge CORS, build, typecheck, and cargo validation still pass.

## Acceptance

- `pnpm vitest run apps/macos-shell/src-tauri/tauri-config.test.ts apps/macos-shell/src-tauri/tray-behavior.test.ts` passes.
- `pnpm vitest run src/interfaces/shell-bridge/http-server.test.ts` passes.
- `pnpm --dir apps/macos-shell build` passes.
- `pnpm typecheck` passes.
- `cargo check` passes from `apps/macos-shell/src-tauri`.
- `pnpm --dir apps/macos-shell exec tauri build --debug` creates a debug `.app`.
- After local signing, `MindWeave.app` can be launched through LaunchServices and appears as the running `MindWeave` app.
- The shell bridge remains reachable from `tauri://localhost`.

## Interruption Notes

If implementation is interrupted:

- `02_execution_index.md` should show WU-08 as `implementing`, `testing`, `passed`, or `blocked`.
- Configuration-only changes are not enough; the Rust tray/window behavior must also be aligned.
- If Tauri cannot support a required panel behavior directly, record the limitation and keep the work unit blocked rather than accepting a regular main window.
