# P0.5 Runtime Capabilities and Agent Access Implementation Outline

This document is an implementation outline for the P0.5 phase. It is not a step-by-step execution plan and should not contain implementation code.

Detailed executable work-unit plans should be created under `work-units/` only when each unit is ready to implement.

## Phase 1: MCP Stdio Server

Build a real MCP stdio server around the existing MCP tool handlers.

Expected result:

- The runtime can serve MCP tools over stdio.
- `search_knowledge` and `list_sources` are available to MCP clients.
- stdout is reserved for MCP protocol messages.
- logs and diagnostics use stderr and/or file logs.

Implementation direction:

- Keep MCP as an interface adapter.
- Reuse existing MCP tool definitions and handlers.
- Do not move query or storage logic into the transport.
- Do not make MCP startup implicitly scan or watch sources.

## Phase 2: MCP CLI Command

Expose the stdio server through a CLI command.

Expected result:

- A command such as `mindweave mcp --config <path>` starts the MCP stdio server.
- The command loads the same effective config as existing commands.
- The command composes existing runtime services.

Implementation direction:

- Keep CLI as a thin adapter.
- Route command handling through app/runtime or a focused runtime service.
- Preserve existing `scan`, `query`, and `status` command behavior.

## Phase 3: Log File Output

Add minimum file logging for runtime use.

Expected result:

- Runtime logs are written to a stable user-visible location.
- MCP stdio serving does not write non-protocol logs to stdout.
- Indexing, provider, watcher, and MCP errors are recorded.

Implementation direction:

- Prefer a small internal logger abstraction.
- Start with one file sink and optional stderr sink.
- Avoid a broad telemetry framework.
- Keep logs useful for users and future UI, not just tests.

## Phase 4: Runtime and Index Status

Make status useful for operational diagnosis.

Expected result:

- Status reports configured sources and effective embedding settings.
- Status reports enough stored index state to explain empty results.
- Status exposes recent errors or failed state where available.

Implementation direction:

- Extend storage reads only where needed.
- Keep status read-only.
- Do not start scan, watch, or MCP while answering status.

## Phase 5: Workflow Composition

Clarify and validate command-level workflow semantics.

Expected result:

- `scan` remains one-shot indexing convergence.
- `query` remains read-oriented retrieval over the current index.
- `mcp` serves MCP only.
- `start` is the recommended local agent workflow and may combine scan, watch, and MCP.
- `watch`, if exposed, starts watcher-driven indexing without MCP.

Implementation direction:

- Reuse existing scan/watch implementations.
- Do not introduce a large capability refactor unless required by concrete duplication or lifecycle conflicts.
- Document remaining workflow gaps clearly.

## Phase 6: Agent-Facing Validation

Validate the phase as an agent-usable runtime.

Expected result:

- A fixture MCP client or integration test can call the stdio server.
- Search results match the existing QueryService result contract.
- A real local configuration can be used for manual validation.
- Remaining gaps are documented before the phase is marked complete.

Implementation direction:

- Keep normal tests deterministic and offline with fake providers.
- Keep live provider testing manual or explicitly opt-in.
- Verify stdout/stderr behavior for stdio transport.

## Later Work

After P0.5, the project can decide whether to:

- Harden scan/watch with a SyncCoordinator.
- Add ambiguous watcher event fallback to source rescan.
- Add HTTP transport.
- Start the P1 macOS Tauri shell.

