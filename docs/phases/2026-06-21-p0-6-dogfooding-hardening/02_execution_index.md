# P0.6 Dogfooding Hardening Execution Index

This document tracks P0.6 as a sequence of small, interruptible work units.

Each work unit should produce an observable improvement in the real local workflow and include targeted validation.

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
- Before implementation, the target work unit should have a detailed work-unit plan.
- Keep detailed task steps inside `work-units/*.md`.
- Keep tests with the work-unit plan instead of creating a separate test plan document.
- Commit after each completed work unit unless the user asks otherwise.
- Work-unit plans should describe implementation logic, files, and validation without embedding large code blocks.

## Work Units

## WU-00 Findings and Phase Alignment

- [x] Status: `passed`
- Plan: phase documents in this directory
- Depends on: P0.5 Runtime Capabilities and Agent Access
- Design refs:
  - `00_dogfooding_findings.md`
  - `00_spec.md`
- Scope:
  - Capture dogfooding findings from the first real vault trial.
  - Define a small hardening phase focused on exposed user-experience issues.
  - Update the documentation index.
- Observable result:
  - The phase has written findings, scope, and work-unit direction.
- Validation summary:
  - Documentation was reviewed for consistency with P0/P0.5 boundaries.
  - P0.6 is limited to dogfooding hardening and excludes UI, HTTP transport, non-Markdown indexing, and graph retrieval.
- Completion criteria:
  - Findings document exists.
  - Phase spec exists.
  - Implementation outline exists.
  - Execution index exists.
  - Documentation index references the phase.

## WU-01 Source Inspection

- [x] Status: `passed`
- Plan: `work-units/01-source-inspection.md`
- Depends on: WU-00
- Design refs:
  - `00_spec.md#source-inspection`
- Scope:
  - Add read-only source inspection before scan/index/embed.
  - Expose included counts, excluded/skipped counts where practical, top-level path counts, and sample paths.
- Observable result:
  - A user can validate source include/exclude behavior before embedding cost is paid.
- Validation summary:
  - Tests prove inspection reports included candidates, excluded paths, skipped counts, top-level counts, and samples.
  - Runtime and CLI tests prove inspection does not route through scan.
  - Real vault validation reported 73 included Markdown documents and the expected excluded paths.
- Completion criteria:
  - Source inspection is available through CLI or runtime adapter.
  - Output is structured and reusable.

## WU-02 Richer Status

- [x] Status: `passed`
- Plan: `work-units/02-richer-status.md`
- Depends on: WU-00
- Design refs:
  - `00_spec.md#richer-runtime-status`
- Scope:
  - Add chunk, embedding, source-level, and provider-readiness diagnostics to status.
  - Keep status read-only.
- Observable result:
  - A user can diagnose indexed content without manual SQLite inspection.
- Validation summary:
  - Storage tests cover populated index stats.
  - Runtime and CLI tests cover empty index stats and provider environment readiness.
  - Real vault validation reported 73 indexed documents, 620 chunks, 620 embeddings, source-level counts, and missing `OPENROUTER_API_KEY` readiness.
- Completion criteria:
  - Status remains read-only.
  - Status includes enough index and provider readiness data for first-line diagnosis.

## WU-03 Scan Progress

- [x] Status: `passed`
- Plan: `work-units/03-scan-progress.md`
- Depends on: WU-01, WU-02
- Design refs:
  - `00_spec.md#scan-progress-visibility`
- Scope:
  - Add coarse scan progress events for CLI/log visibility.
  - Preserve MCP stdout isolation.
- Observable result:
  - Long first-run scans are no longer silent.
- Validation summary:
  - Runtime tests cover coarse progress event emission.
  - CLI tests cover scan progress JSON lines.
  - Existing MCP command tests continue proving `mcp` remains serve-only.
  - Real vault validation showed scan progress lines for scan start, source scan start, source scan finish, scan finish, and final scanned status.
- Completion criteria:
  - CLI/log output can show scan start, discovery, indexing, failures, and finish.

## WU-04 Local Usage Guide

- [x] Status: `passed`
- Plan: `work-units/04-local-usage-guide.md`
- Depends on: WU-01, WU-02, WU-03
- Design refs:
  - `00_spec.md#usage-documentation`
- Scope:
  - Document local config, provider env, CLI workflow, MCP setup, and score interpretation.
- Observable result:
  - A user can reproduce the dogfooding workflow from documentation.
- Validation summary:
  - Local usage guide documents config, env keys, inspect, status, scan, query, MCP, watch, start, score semantics, and recommended agent workflow.
  - Commands were checked against current CLI behavior during dogfooding validation.
- Completion criteria:
  - Local usage guide exists.
  - It avoids real secrets.
  - It explains `mcp` serve-only semantics and recommended agent workflow.

## WU-05 Dogfooding Re-Validation

- [x] Status: `passed`
- Plan: `work-units/05-dogfooding-re-validation.md`
- Depends on: WU-01 through WU-04
- Design refs:
  - `00_spec.md#acceptance-criteria`
- Scope:
  - Repeat real-vault validation after hardening.
  - Record remaining product issues.
- Observable result:
  - The improved inspect/status/scan/query/MCP flow works on the real vault.
- Validation summary:
  - Real vault `inspect` passed and reported expected include/exclude behavior.
  - Real vault `status` passed and reported richer diagnostics.
  - Real vault `scan` passed and showed progress JSON lines.
  - Real vault `query` passed and retrieved DP chunks from `Solving Patterns.md`.
  - Deterministic tests and typecheck passed during implementation.
- Completion criteria:
  - P0.6 acceptance criteria are checked.
  - Remaining gaps are documented before moving to the next phase.

## Deferred Work

The following work remains intentionally deferred:

- Tauri UI.
- HTTP MCP transport.
- persistent job queue.
- non-Markdown sources.
- code-aware indexing.
- graph retrieval.
- generated answers or relevance explanations.
