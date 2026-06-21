# P0.5 Runtime Capabilities and Agent Access Execution Index

This document tracks P0.5 execution as a sequence of small, interruptible work units.

Each work unit should produce a small observable result, have targeted validation, and leave the repository in a clean state when complete.

## Status Model

Checkbox state tracks final completion:

- `[ ]`: not fully complete.
- `[x]`: implemented, validated, committed, and accepted for this work unit.

Status tags track current phase:

- `planned`: scope is listed here, but no detailed executable plan exists yet.
- `plan-ready`: detailed executable plan exists and can be executed.
- `implementing`: code is being changed for the work unit.
- `implemented`: code changes are complete, but validation is not complete.
- `testing`: validation is running or failures are being fixed.
- `passed`: implementation and validation are complete.
- `blocked`: progress requires a decision, dependency, or design correction.
- `deferred`: intentionally postponed.

## Execution Rules

- Execute one work unit at a time.
- Before implementation, the target work unit must have status `plan-ready`.
- Update this index when a work unit moves between planning, implementation, testing, and passed states.
- Keep detailed task steps inside `work-units/*.md`.
- Keep tests with the work unit plan instead of creating a separate test plan document.
- Commit after each completed work unit unless the user asks otherwise.
- Work-unit plans should describe implementation logic, files, and validation without embedding large code blocks.

## Work Units

## WU-00 Phase Documentation and Alignment

- [x] Status: `passed`
- Plan: phase documents in this directory
- Depends on: P0 Core MVP completion
- Design refs:
  - `00_spec.md`
  - `03_detailed_design.md`
- Scope:
  - Create the P0.5 phase documentation.
  - Align on agent access, MCP stdio, command semantics, logs, and status.
  - Confirm scan/watch remain existing reusable baselines and are not refactored first.
- Observable result:
  - The phase has enough written direction to create detailed work-unit plans.
- Validation summary:
  - Documentation self-review confirms scope, boundaries, and work-unit order are consistent.
  - Placeholder scan found no unresolved markers or implementation-language code blocks.
  - Phase docs keep scan/watch refactor, SyncCoordinator, HTTP transport, and Tauri shell deferred.
- Completion criteria:
  - Phase docs exist.
  - Documentation index references the phase.
  - User approves the phase direction.

## WU-01 MCP Stdio Server Plan

- [x] Status: `passed`
- Plan: `work-units/01-mcp-stdio-server-plan.md`
- Depends on: WU-00
- Design refs:
  - `03_detailed_design.md#5-mcp-stdio-transport`
  - `03_detailed_design.md#6-mcp-tool-contract`
- Scope:
  - Create a detailed executable plan for implementing MCP stdio serving.
  - Select the MCP TypeScript SDK and test approach.
  - Define stdout/stderr and lifecycle behavior.
- Observable result:
  - A plan exists that can be executed without guessing MCP transport boundaries.
- Validation summary:
  - Plan review confirms no scan/watch refactor is required for MCP serving.
  - SDK decision recorded: use `@modelcontextprotocol/sdk` v1.
  - Stdio server and CLI command are intentionally split into separate work units.
- Completion criteria:
  - Work-unit plan exists and is approved.

## WU-02 MCP Stdio Server Implementation

- [x] Status: `passed`
- Plan: `work-units/01-mcp-stdio-server-plan.md`
- Depends on: WU-01
- Design refs:
  - `03_detailed_design.md#5-mcp-stdio-transport`
  - `03_detailed_design.md#10-testing-strategy`
- Scope:
  - Implement stdio MCP serving for existing tool handlers.
  - Keep protocol output on stdout and diagnostics off stdout.
  - Add deterministic tests.
- Observable result:
  - A test client or protocol fixture can call `search_knowledge` through stdio serving.
- Validation summary:
  - Typecheck and tests pass.
  - MCP handler behavior remains unchanged.
  - MCP stdio server uses `@modelcontextprotocol/sdk` in-memory transport for deterministic tests.
  - Targeted MCP tests cover tool listing, `search_knowledge`, `list_sources`, and handler error propagation.
- Completion criteria:
  - MCP stdio serving works in tests.
  - No retrieval logic is implemented in the transport.

## WU-03 MCP CLI Command and Serve-Only Semantics

- [x] Status: `passed`
- Plan: `work-units/03-mcp-cli-command-and-serve-only-semantics.md`
- Depends on: WU-02
- Design refs:
  - `03_detailed_design.md#4-capability-and-workflow-principle`
- Scope:
  - Add or finalize the CLI command that starts MCP stdio serving.
  - Ensure `mcp` does not implicitly run scan or watch.
  - Preserve existing `scan`, `query`, and `status` behavior.
- Observable result:
  - The CLI can start MCP serving over an existing index.
- Validation summary:
  - Tests prove `mcp` command is serve-only.
  - CLI tests cover injected MCP serving and prove `scan()` and `start()` are not called.
  - Usage text includes `mcp --config <path>`.
- Completion criteria:
  - Command semantics are documented and tested.

## WU-04 Log File Output

- [x] Status: `passed`
- Plan: `work-units/04-log-file-output.md`
- Depends on: WU-02
- Design refs:
  - `03_detailed_design.md#7-logging-design`
- Scope:
  - Add minimal file logging.
  - Add stderr-safe diagnostics for MCP stdio.
  - Record runtime, MCP, indexing, watcher, and provider failures where practical.
- Observable result:
  - A user can find a log file that explains common failures.
- Validation summary:
  - Tests cover file sink behavior and stdout isolation for MCP stdio where practical.
  - Logger tests cover file creation, JSONL append behavior, and default path derivation.
  - Runtime tests cover scan start/finish events and query failure logging.
- Completion criteria:
  - Logs are written to a stable location.
  - Secrets are not intentionally logged.

## WU-05 Runtime and Index Status

- [x] Status: `passed`
- Plan: `work-units/05-runtime-and-index-status.md`
- Depends on: WU-04
- Design refs:
  - `03_detailed_design.md#8-status-design`
- Scope:
  - Enrich status with useful index and runtime metadata.
  - Add storage read support for document status counts if needed.
  - Include log path and storage path where appropriate.
- Observable result:
  - `status` can explain whether configured sources have indexed, stale, failed, or deleted documents.
- Validation summary:
  - Tests cover status over empty and populated indexes.
  - SQLite tests cover document counts by status.
  - Runtime and CLI status tests cover storage path, log path, and zero document counts.
- Completion criteria:
  - Status remains read-only.
  - Status does not trigger scan, watch, MCP, or provider calls.

## WU-06 Workflow Semantics and Start Command

- [x] Status: `passed`
- Plan: `work-units/06-workflow-semantics-and-start-command.md`
- Depends on: WU-03, WU-04
- Design refs:
  - `03_detailed_design.md#4-capability-and-workflow-principle`
- Scope:
  - Clarify and test workflow command behavior.
  - Decide whether `watch` is publicly exposed in this phase.
  - Define `start` as the recommended local agent workflow if it combines scan, watch, and MCP.
- Observable result:
  - Users and future UI code can rely on clear command semantics.
- Validation summary:
  - CLI tests cover lifecycle behavior at the command/runtime boundary.
  - `mcp` remains serve-only.
  - `watch` starts runtime scan/watch behavior without serving MCP.
  - `start` starts runtime scan/watch behavior and then serves MCP.
- Completion criteria:
  - Command behavior is documented and tested.
  - Existing scan/watch implementation is reused.

## WU-07 Agent-Facing End-to-End Validation

- [x] Status: `passed`
- Plan: `work-units/07-agent-facing-end-to-end-validation.md`
- Depends on: WU-02 through WU-06
- Design refs:
  - `00_spec.md#acceptance-criteria`
  - `03_detailed_design.md#11-completion-definition`
- Scope:
  - Validate the complete P0.5 path from indexed local knowledge to MCP client retrieval.
  - Keep deterministic tests offline.
  - Record manual live-provider validation steps separately.
- Observable result:
  - An MCP client can retrieve indexed chunks through `search_knowledge`.
- Validation summary:
  - Runtime e2e test covers scan, index, query, MCP client `search_knowledge`, edit update, and delete reconciliation.
  - MCP client validation uses deterministic in-memory transport and fake embeddings.
  - MCP result assertions cover chunk text, score, source, document, URI, and status metadata.
  - `list_sources` is validated through the MCP client path.
- Completion criteria:
  - P0.5 acceptance criteria pass.
  - Remaining gaps are documented before the phase is marked passed.

## Deferred Work

The following work is intentionally deferred unless a concrete blocker appears:

- Scan/watch capability refactor.
- SyncCoordinator extraction.
- `SourceChangeSignal` replacement for `SourceFileEvent`.
- Ambiguous watcher event fallback to source rescan.
- HTTP MCP transport.
- Tauri shell.
