# Local Usage Guide Work Plan

**Goal:** Document the validated local workflow so a user can configure, inspect, index, query, and serve MCP without reading implementation code.

**Architecture:** Documentation should describe current CLI/runtime semantics. It should avoid real secrets and keep MindWeave positioned as a retrieval layer.

## Implementation Notes

- Add local config example.
- Document environment variable based API keys.
- Document `inspect`, `status`, `scan`, `query`, `mcp`, `watch`, and `start`.
- Document MCP stdio command shape.
- Document recommended agent workflow.
- Document retrieval score semantics.

## Validation

- Commands match current CLI usage.
- Examples avoid real API keys.
- Guide explains that `mcp` serves the existing index and does not scan implicitly.
