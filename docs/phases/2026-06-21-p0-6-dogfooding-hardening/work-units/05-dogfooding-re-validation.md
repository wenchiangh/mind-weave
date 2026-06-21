# Dogfooding Re-Validation Work Plan

**Goal:** Re-run the real local workflow after P0.6 hardening and record whether the exposed issues were reduced.

**Architecture:** Live provider validation remains manual and outside deterministic unit tests. Normal tests continue to use offline fixtures.

## Validation Flow

1. Run source inspection against the real vault config.
2. Run status against the real vault config.
3. Confirm scan progress is observable through CLI JSON lines.
4. Confirm query still returns useful chunks.
5. Confirm deterministic tests and typecheck pass.

## Completion Criteria

- Inspect/status outputs explain source and index state without ad hoc SQLite queries.
- Scan progress is visible during CLI scan.
- The local usage guide matches the observed behavior.
- Remaining gaps are recorded for future phases.
