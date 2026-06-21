# Richer Status Work Plan

**Goal:** Make `status` useful enough for first-line index and provider diagnosis without manual SQLite inspection.

**Architecture:** Storage exposes read-only index diagnostics. Runtime composes storage diagnostics with provider configuration readiness.

## Implementation Notes

- Add read-only `IndexStatsStore`.
- Report chunk count, embedding count, and source-level document status counts.
- Add provider readiness to embedding status.
- Read API key presence from the configured environment variable name without exposing secret values.
- Do not call embedding APIs while computing status.

## Validation

- SQLite tests cover populated index stats.
- Runtime and CLI status tests cover empty index stats and missing API key readiness.
- Existing status behavior remains read-only.
