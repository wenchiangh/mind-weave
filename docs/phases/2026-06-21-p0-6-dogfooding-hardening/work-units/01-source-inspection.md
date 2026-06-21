# Source Inspection Work Plan

**Goal:** Add a read-only source inspection path so users can validate local filesystem include/exclude behavior before embedding cost is paid.

**Architecture:** Source inspection belongs to the source/runtime boundary. CLI exposes it first, but the output remains structured and reusable by future UI surfaces.

## Implementation Notes

- Extend source contracts with `SourceInspector` and `SourceInspectionResult`.
- Implement inspection in `LocalFsSourceProvider`.
- Keep `scan()` behavior unchanged by deriving scan candidates from inspection output.
- Add `AppRuntime.inspectSources()`.
- Add `mindweave inspect --config <path>`.

## Validation

- `LocalFsSourceProvider.inspect()` reports included candidates, excluded paths, ignored hidden paths, unsupported files, symlinks, top-level path counts, and samples.
- Runtime inspection does not mutate storage.
- CLI inspection does not call scan.
