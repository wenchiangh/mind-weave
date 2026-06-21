# Runtime SDK and Shell Bridge Boundary Design

## Layer Model

The desired layering is:

```text
Core Runtime SDK / AppRuntime
  -> used directly by CLI
  -> used directly by Node.js sidecar bridge
  -> used directly by tests

Node.js sidecar bridge
  -> belongs to macOS Tauri Shell
  -> exposes a local transport to Tauri

Tauri Shell
  -> owns tray, windows, platform actions, and sidecar lifecycle

MCP
  -> agent access surface over retrieval/source-read contracts
```

The sidecar bridge exists because Tauri cannot naturally call TypeScript Core in-process. It is not a new core layer.

## Runtime SDK Capability Categories

The Runtime SDK / AppRuntime should expose capability-oriented operations.

### Runtime Health

Purpose:

- tell a human shell whether Core can load and answer basic status requests

Expected data:

- runtime availability
- config path
- storage path
- log path
- active source count
- high-level error if startup failed

### Read-Only Config Info

Purpose:

- let shells show what config is currently active
- let users open the config file or folder manually

Expected data:

- config file path
- effective sources summary
- embedding provider summary without secrets
- storage path
- log path

P0.9 should not require config editing or config hot reload.

### Source Inspection

Purpose:

- let users validate include/exclude behavior before paying embedding cost

Expected data:

- included document count
- skipped counts
- top-level path counts
- sample included paths
- sample excluded/skipped paths when available

### Index Status

Purpose:

- explain whether the local knowledge base is indexed and queryable

Expected data:

- document counts by status
- chunk count
- embedding count
- per-source document counts
- last scan time where available
- failed document counts and high-level errors where available

### Scan Action

Purpose:

- run a one-shot scan/index pass

Expected behavior:

- starts source discovery and indexing through existing runtime flow
- emits progress events
- returns final summary
- does not require watch to be running
- does not require MCP to be running

### Watch Capability

Purpose:

- keep local file changes converging into the index while the runtime is active

Expected operations:

- start watching
- stop watching
- read watch status

Expected status:

- stopped
- starting
- running
- stopping
- error

Watch status should be independent from MCP access status.

### Provider Readiness

Purpose:

- show whether indexing/query embedding can currently call the configured provider

Expected data:

- provider type
- model
- base URL when safe
- API key env var name
- whether the key appears present
- readiness state
- last provider error when available and safe

No secret values should be returned.

### Log Info

Purpose:

- let shells open logs and show where runtime diagnostics are written

Expected data:

- log directory
- current log file path if available

The Tauri shell owns the platform action to open the folder.

### MCP Access Info

Purpose:

- help humans understand how agents can connect to MindWeave

Expected data:

- supported MCP transport modes
- current stdio command setup information
- whether MCP tool handlers are available in the current runtime
- last MCP serving error if tracked

P0.9 should be cautious about `startMcp` and `stopMcp`.

Current stdio MCP is normally launched by an agent client as a command. It is not necessarily a long-running daemon controlled by Tauri. A future non-stdio MCP serving mode can have explicit lifecycle controls after the serving model is designed.

## Adapter Ownership

### CLI Adapter Owns

- argv parsing
- command help
- stdout/stderr formatting
- JSON lines formatting
- exit code mapping

CLI should not own reusable status, inspect, scan, watch, config, or MCP setup logic.

### Tauri Shell Owns

- tray/menu/window UI
- frontend state
- platform open-file/open-folder actions
- sidecar lifecycle
- bridge connection state
- packaging and macOS integration

Tauri should not own source scanning, indexing, storage, query, embedding, or config validation.

### Node.js Sidecar Bridge Owns

- importing Runtime SDK
- running the Core runtime inside a Node.js process
- exposing a local bridge transport to Tauri
- serializing runtime SDK results and progress events
- isolating transport errors from core errors

The bridge should stay thin and testable.

### MCP Adapter Owns

- MCP tool definitions
- MCP input validation
- MCP output serialization
- mapping agent tool calls to retrieval/source-read contracts

MCP should not own human runtime control semantics.

## Bridge Transport Evaluation Criteria

Transport choice should be evaluated by:

- local-only security model
- ease of Tauri integration
- ability to stream progress/events
- testability without a full Tauri app
- packaging complexity
- failure visibility
- future replaceability

Local HTTP is a practical first candidate because it is easy to test and works well for status/progress calls. It should still remain a bridge adapter, not the stable core API.

## Implementation Planning Implication

The first implementation work should not start by adding HTTP routes.

It should start by checking and tightening the Runtime SDK/AppRuntime surface:

```text
current CLI commands
  -> should call AppRuntime operations
  -> reusable logic should sit below CLI
```

Only after that should a sidecar bridge transport be planned.

