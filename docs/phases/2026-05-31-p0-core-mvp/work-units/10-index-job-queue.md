# Index Job Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement in-memory indexing job queue primitives for document upsert/delete scheduling.

**Architecture:** The queue belongs to `src/indexing`. It schedules jobs and delegates actual work to an injected handler. It must not read files, process Markdown, call embeddings, write storage, scan sources, or depend on CLI/runtime adapters.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest fake timers.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#8-indexing-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/05-identity-and-document-fingerprint.md`

## Current Starting Point

WU-01 created indexing contracts:

- `IndexJobType`
- `IndexJobStatus`
- `IndexDocumentTarget`
- `IndexJob`
- `IndexingService`

WU-10 should implement queue behavior, not indexing pipeline behavior.

## Non-Goals

- Do not implement document loading.
- Do not implement source scanning.
- Do not implement Markdown processing.
- Do not call embedding providers.
- Do not write storage.
- Do not implement scan reconciliation.
- Do not implement document upsert flow.
- Do not implement delete reconciliation.
- Do not add persistent job storage.

## Queue Behavior

The queue should:

- Keep jobs in memory only.
- Support `upsert-document` and `delete-document`.
- Debounce newly enqueued jobs.
- Coalesce pending jobs by `documentId`.
- Process jobs with concurrency 1.
- Not cancel a running job.
- Queue a follow-up job when a new event for the same running document arrives.
- Retry retryable failures up to `maxRetries`.
- Expose `drain()` for tests and future CLI/runtime use.

Defaults:

- `debounceMs`: 2000
- `maxRetries`: 3
- `retryBackoffMs`: 100
- concurrency: 1

Constructor settings may override defaults for tests.

## Coalescing Rules

For pending jobs with the same document ID:

- pending upsert replaced by later upsert.
- pending delete overrides pending upsert.
- later upsert replaces pending delete.
- latest target metadata wins.

For running jobs:

- running job is not cancelled.
- later event for the same document becomes a pending follow-up job.
- follow-up is coalesced by the same pending rules.
- follow-up runs after current job completes.

## Retry Semantics

The injected handler may:

- succeed
- fail retryably
- fail permanently

WU-10 should provide a queue-owned retry error type or helper. Unknown errors can be treated as retryable up to `maxRetries` unless explicitly permanent.

Retry behavior:

- attempts count starts at 0 on initial job object and increments per handler attempt.
- retryable failure retries until `maxRetries` is reached.
- permanent failure does not retry.
- after final failure, queue continues to later jobs.

## File Responsibilities

Expected files:

- `src/indexing/queue.ts`
  - Own `InMemoryIndexJobQueue`.
  - Own queue settings and handler types.
  - Own retryable/permanent queue errors if needed.

- `src/indexing/queue.test.ts`
  - Own queue behavior tests with fake timers.

- `src/indexing/index.ts`
  - Re-export indexing contracts and queue APIs.

Existing files may change:

- `src/indexing/contracts.ts`
  - May add minimal queue-owned types if needed.

- `src/index.ts`
  - May export queue APIs.

## Testing Strategy

Tests should cover:

- same-document pending upsert replacement.
- delete overriding pending upsert.
- later upsert replacing pending delete.
- different documents execute in deterministic FIFO order.
- debounce timing using fake timers.
- running job is not cancelled.
- event during running job creates follow-up job.
- retryable failure retries up to limit.
- permanent failure does not retry.
- final failure does not stop later jobs.
- `drain()` resolves after queued/retry/follow-up jobs complete.
- indexing module boundary does not import config, app, CLI, source provider implementation, processors, embeddings, storage, or query modules.

## Implementation Tasks

### Task 1: [x] Create Queue API and Errors

**Files:**

- Create: `src/indexing/queue.ts`
- Create: `src/indexing/index.ts`
- Modify: `src/index.ts`

Plan:

- Define handler, queue settings, queue errors, and `InMemoryIndexJobQueue`.
- Keep API small and independent from downstream implementations.

Validation:

- Typecheck passes.

### Task 2: [x] Implement Debounce and Pending Coalescing

**Files:**

- Modify: `src/indexing/queue.ts`
- Create: `src/indexing/queue.test.ts`

Plan:

- Store pending jobs by document ID.
- Debounce processing after enqueue.
- Apply coalescing rules.

Validation:

- Tests cover pending upsert/delete replacement and fake timer debounce.

### Task 3: [x] Implement Serial Processing and Running Follow-Up

**Files:**

- Modify: `src/indexing/queue.ts`
- Modify: `src/indexing/queue.test.ts`

Plan:

- Process one job at a time.
- Keep running document ID visible to enqueue logic.
- Enqueue same-document follow-up after current job completes.

Validation:

- Tests cover no cancellation and follow-up sequencing.

### Task 4: [x] Implement Retry and Drain

**Files:**

- Modify: `src/indexing/queue.ts`
- Modify: `src/indexing/queue.test.ts`

Plan:

- Retry retryable errors up to max retries.
- Do not retry permanent errors.
- Ensure queue continues after final failure.
- Implement `drain()`.

Validation:

- Retry, permanent failure, continuation, and drain tests pass.

### Task 5: [x] Boundary and Status Update

**Files:**

- Add boundary test if useful.
- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: this work-unit document.

Plan:

- Add module boundary validation.
- Mark checklist complete and WU-10 passed after validation.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.

## Success Check

WU-10 is successful only if:

- Queue accepts noisy document events and produces deterministic execution sequence.
- Pending jobs coalesce by document ID.
- Running jobs are not cancelled.
- Same-document events during running jobs produce follow-up jobs.
- Retry limits are enforced.
- `drain()` reliably waits for idle queue state.
- Queue remains independent from filesystem, processors, embeddings, storage, query, runtime, and CLI.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If queue API does not exist, resume at Task 1.
- If debounce/coalescing is incomplete, resume at Task 2.
- If serial processing/follow-up behavior is incomplete, resume at Task 3.
- If retry/drain behavior is incomplete, resume at Task 4.
- If validation/status updates are missing, resume at Task 5.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan implements queue behavior only, not indexing pipeline work.
- [x] The plan matches accepted in-memory queue/coalescing/retry behavior.
- [x] The plan uses tests to observe deterministic execution order.
- [x] The plan keeps indexing queue independent from source, processor, embedding, and storage implementations.
