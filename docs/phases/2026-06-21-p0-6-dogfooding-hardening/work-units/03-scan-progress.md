# Scan Progress Work Plan

**Goal:** Make long first-run scans observable without changing the indexing model.

**Architecture:** Runtime emits coarse scan progress events. CLI serializes those events as JSON lines for scan commands. MCP stdout remains protocol-only because MCP serving does not call scan.

## Implementation Notes

- Add `RuntimeScanProgressEvent`.
- Let `scan()` accept an optional progress callback.
- Emit scan start, source scan start, source scan finish, and scan finish events.
- Log the same coarse events for diagnosis.
- Keep progress intentionally coarse rather than percentage-based.

## Validation

- Runtime tests cover progress event order.
- CLI tests cover scan progress JSON lines.
- MCP command tests continue proving `mcp` is serve-only.
