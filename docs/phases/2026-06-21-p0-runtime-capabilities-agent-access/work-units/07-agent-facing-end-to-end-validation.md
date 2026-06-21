# Agent-Facing End-to-End Validation Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:verification-before-completion to validate this phase before marking it complete.

**Goal:** Prove that the P0.5 runtime can serve indexed local Markdown knowledge to an MCP client through the agent-facing tool contract.

**Architecture:** This work unit validates the composed system. It should not add new capabilities unless validation exposes a concrete gap.

**Tech Stack:** TypeScript, Vitest, existing runtime composition, SQLite/sqlite-vec, fake embedding provider, MCP TypeScript SDK in-memory transport.

---

## Source Documents

- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/00_spec.md#acceptance-criteria`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#10-testing-strategy`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md#11-completion-definition`
- `docs/phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md`

## Validation Scope

The validation should prove:

- a local Markdown source can be scanned and indexed
- indexed content can be queried through runtime query
- the same indexed content can be retrieved by an MCP client calling `search_knowledge`
- MCP retrieval returns chunk text, score, source identity, document identity, URI, and status metadata
- `list_sources` works through the same MCP client path
- normal validation stays offline and deterministic

Live provider validation remains optional and manual. It should not be required for normal CI or local test success.

## Implementation Tasks

### Task 1: Add MCP Client E2E Coverage

- Extend the runtime end-to-end test with an MCP client/server connection over an in-memory transport.
- Use the existing fake embedding provider and SQLite storage fixture.
- Call `search_knowledge` through the MCP client after `runtime.scan()`.
- Parse the JSON text payload returned by the MCP tool.
- Assert the result includes the expected chunk content and required retrieval metadata.
- Call `list_sources` through the same client and assert the configured source is visible.

### Task 2: Verify Command and Protocol Behavior

- Run targeted runtime e2e tests.
- Run MCP interface tests.
- Run CLI workflow tests.
- Run typecheck.
- Run the full test suite.

### Task 3: Update Phase Tracking

- Mark WU-07 passed only after the validation commands pass.
- Update any phase-level design status that is outdated after implementation.
- Keep deferred scan/watch hardening work deferred unless a validation failure proves it is required.

## Success Check

This work unit is successful when:

- an MCP client can retrieve indexed Markdown chunks through `search_knowledge`
- MCP output includes chunk text, score, source, document, URI, and status metadata
- `list_sources` works through the MCP client path
- `pnpm typecheck` passes
- `pnpm test` passes
- P0.5 execution index reflects the completed validation
