# Embedding Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement provider-independent embedding generation with an OpenAI-compatible HTTP adapter and deterministic fake provider for tests.

**Architecture:** Embedding providers belong to `src/embeddings`. They convert text into vectors behind the `EmbeddingProvider` contract. WU-09 must not implement indexing, storage writes, query service, MCP, or CLI behavior.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, built-in `fetch`, deterministic local hashing for fake vectors.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#12-embedding-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#15-testing-strategy`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Current Starting Point

WU-01 created:

- `EmbeddingProvider`
- `EmbeddingInput`
- `EmbeddingResult`
- `EmbeddingConfigIdentity`
- `EmbeddingProviderErrorKind`

WU-09 should implement concrete provider classes while keeping tests network-free.

## Non-Goals

- Do not call real OpenAI or remote APIs in normal tests.
- Do not implement indexing status behavior.
- Do not implement QueryService.
- Do not write storage.
- Do not implement model switching or reset-index behavior.
- Do not introduce provider-specific SDK packages.
- Do not store API keys.
- Do not implement keychain or secret manager support.

## Provider Behavior

OpenAI-compatible provider:

- Uses `POST {baseUrl}/embeddings`.
- Uses bearer token from `apiKey` when configured, otherwise from `apiKeyEnv`.
- Sends `model`, `input`, and optional `dimensions`.
- Supports document embedding in batches.
- Supports query embedding through the same active configuration.
- Preserves result order by input order.
- Maps provider response vectors back to input IDs.
- Retries transient errors up to a configured maximum.
- Does not retry auth/config/invalid request errors endlessly.

Fake provider:

- Produces deterministic vectors from input text.
- Requires no network.
- Supports both document and query embedding.
- Uses the same `EmbeddingProvider` contract.
- Allows configurable dimensions for tests.

## Error Semantics

Add embedding-owned structured errors.

Recommended fields:

- machine-readable `kind`
- human-readable message
- HTTP status when available
- retryability helper

Error kind mapping:

- missing API key or malformed provider config: `configuration`
- HTTP 401/403: `authentication`
- HTTP 429: `rate-limit`
- HTTP 400/404/422: `invalid-request`
- HTTP 408/409/425/5xx and network failures: `transient`

## File Responsibilities

Expected files:

- `src/embeddings/errors.ts`
  - Own structured embedding provider errors.

- `src/embeddings/openai-compatible.ts`
  - Own OpenAI-compatible request/response mapping, batching, retry, and error classification.

- `src/embeddings/fake.ts`
  - Own deterministic fake provider.

- `src/embeddings/index.ts`
  - Re-export contracts and provider APIs.

- `src/embeddings/openai-compatible.test.ts`
  - Mock fetch tests only.

- `src/embeddings/fake.test.ts`
  - Deterministic fake provider tests.

Existing files may change:

- `src/embeddings/contracts.ts`
  - May add minimal config types if useful.

- `src/index.ts`
  - May export embedding APIs.

## Testing Strategy

Normal tests must not make network calls.

OpenAI-compatible tests should cover:

- request payload uses `model` and array `input`.
- `dimensions` is omitted when not configured.
- `dimensions` is included when configured.
- API key is read from configured environment variable.
- missing API key returns configuration error.
- document inputs are batched by configured batch size.
- response vectors are mapped back to input IDs in order.
- query embedding returns one vector.
- 401/403 classify as authentication and do not retry.
- 429 classifies as rate-limit and retries up to max retries.
- 500/network failure classifies as transient and retries.
- 400 classifies as invalid-request and does not retry.

Fake provider tests should cover:

- deterministic vectors for the same input.
- different text produces different vectors.
- dimensions are respected.
- document and query embedding use the same config identity.

Boundary tests should prove embeddings do not import config, app, CLI, storage, indexing, processors, sources, or query modules.

## Implementation Tasks

### Task 1: [x] Define Embedding Errors and Exports

**Files:**

- Create: `src/embeddings/errors.ts`
- Create: `src/embeddings/index.ts`
- Modify: `src/index.ts`

Plan:

- Add structured embedding error.
- Re-export intended embedding APIs.

Validation:

- Typecheck passes.

### Task 2: [x] Implement FakeEmbeddingProvider

**Files:**

- Create: `src/embeddings/fake.ts`
- Create: `src/embeddings/fake.test.ts`

Plan:

- Generate deterministic numeric vectors from text.
- Respect configured dimensions.
- Return `EmbeddingResult` with config identity.

Validation:

- Fake provider tests pass without network.

### Task 3: [x] Implement OpenAI-Compatible Request Mapping

**Files:**

- Create: `src/embeddings/openai-compatible.ts`
- Create: `src/embeddings/openai-compatible.test.ts`

Plan:

- Use injected fetch implementation for tests.
- Read API key from inline config first, falling back to env by `apiKeyEnv`.
- Build `/embeddings` requests.
- Include dimensions only when configured.
- Map response vectors to input IDs.

Validation:

- Request/response mapping tests pass without network.

### Task 4: [x] Implement Batching and Query Embedding

**Files:**

- Modify: `src/embeddings/openai-compatible.ts`
- Modify: `src/embeddings/openai-compatible.test.ts`

Plan:

- Split document embeddings by batch size.
- Implement `embedQuery`.
- Preserve ordering across batches.

Validation:

- Batching and query tests pass.

### Task 5: [x] Implement Error Classification and Retry

**Files:**

- Modify: `src/embeddings/errors.ts`
- Modify: `src/embeddings/openai-compatible.ts`
- Modify: `src/embeddings/openai-compatible.test.ts`

Plan:

- Classify HTTP and network failures.
- Retry transient/rate-limit errors up to max retries.
- Do not retry configuration, authentication, or invalid request errors.

Validation:

- Retry and non-retry tests pass deterministically.

### Task 6: [x] Boundary and Status Update

**Files:**

- Add boundary test if useful.
- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- Modify: this work-unit document.

Plan:

- Add module boundary validation.
- Mark checklist complete and WU-09 passed after validation.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.

## Success Check

WU-09 is successful only if:

- OpenAI-compatible provider embeds document batches and query text through the `EmbeddingProvider` contract.
- Fake provider gives deterministic network-free vectors.
- API key environment lookup works.
- Optional dimensions behavior is tested.
- Retryable and non-retryable failures are classified and tested.
- Normal test suite has no real network dependency.
- Embedding module remains independent from config, app, CLI, storage, indexing, processors, sources, and query modules.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If errors/exports are missing, resume at Task 1.
- If fake provider is missing, resume at Task 2.
- If OpenAI request mapping is missing, resume at Task 3.
- If batching/query support is missing, resume at Task 4.
- If retry/error classification is missing, resume at Task 5.
- If validation/status updates are missing, resume at Task 6.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan keeps normal tests network-free.
- [x] The plan uses the existing `EmbeddingProvider` contract.
- [x] The plan keeps embedding providers separate from indexing, storage, and query modules.
- [x] The plan covers fake provider determinism, batching, dimensions, env API key lookup, and retry classification.
