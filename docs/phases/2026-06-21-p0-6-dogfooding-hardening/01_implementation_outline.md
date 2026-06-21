# P0.6 Dogfooding Hardening Implementation Outline

This document is an implementation outline for the P0.6 phase. It is not a detailed executable plan and should not contain implementation code.

Detailed work-unit plans should be created under `work-units/` when each unit is ready to implement.

## Phase 1: Source Inspection

Build a read-only way to inspect configured local filesystem sources before scan/index/embed.

Expected result:

- users can validate include/exclude behavior before paying embedding cost
- source inspection does not mutate storage
- source inspection does not call embedding providers
- output includes useful counts and sample paths

Implementation direction:

- reuse existing source provider scan behavior where possible
- keep inspection output as structured data
- expose it first through CLI
- keep the underlying operation reusable by future UI shells

## Phase 2: Richer Status

Make status enough for first-line diagnosis.

Expected result:

- status exposes document, chunk, and embedding counts
- status reports source-level document counts
- status reports provider configuration readiness without exposing secrets
- users can diagnose empty or incomplete indexes without ad hoc SQLite queries

Implementation direction:

- extend storage read contracts conservatively
- keep status read-only
- avoid provider network calls in readiness checks
- keep output stable and structured

## Phase 3: Scan Progress

Expose coarse scan progress for long first-run indexing.

Expected result:

- CLI scan is no longer silent for multi-minute runs
- logs contain enough events to reconstruct where scan time went
- MCP stdout remains protocol-only

Implementation direction:

- prefer progress events emitted by runtime/indexing boundaries
- let CLI choose how to display progress
- keep initial progress coarse rather than exact percentage-based

## Phase 4: Local Usage Guide

Document the validated local workflow and MCP setup.

Expected result:

- users can configure a local vault source
- users can validate excludes
- users can run scan/query/status
- users can configure a local MCP stdio client
- score interpretation is clear

Implementation direction:

- write docs from the dogfooding path, not from abstract API intent
- include example commands and config shape
- avoid embedding real secrets

## Phase 5: Dogfooding Re-Validation

Repeat the real-vault workflow after the improvements.

Expected result:

- the same vault can be inspected, scanned, queried, and served through MCP
- the previous pain points are materially reduced
- remaining issues are recorded as new findings or future work

Implementation direction:

- keep live provider validation manual or explicitly opt-in
- keep normal tests deterministic and offline
- verify both CLI behavior and reusable runtime contracts
