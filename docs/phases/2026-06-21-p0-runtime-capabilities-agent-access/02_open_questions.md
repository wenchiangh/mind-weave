# P0.5 Runtime Capabilities and Agent Access Open Questions

These questions should be answered during detailed planning or early implementation spikes. They are not blockers for the phase direction.

## MCP

- Which MCP TypeScript SDK package should be used for stdio serving?
- What exact stdio server lifecycle should be exposed by the app/runtime layer?
- How should MCP tool handler errors map to MCP protocol errors?
- Should `mcp` support only `--config <path>`, or also a default config path in this phase?
- What fixture MCP client should be used for integration tests?

## Command Semantics

- Should `watch` be exposed as a public CLI command in P0.5, or remain internal to `start`?
- Should `start` block forever once MCP stdio serving starts?
- If `start` combines scan, watch, and MCP, what is the exact shutdown behavior?
- Should `mcp` fail clearly when no index exists, or simply return empty results through normal query behavior?

## Logging

- What should the default log directory be?
- Should logs be JSONL, plain text, or a small structured text format?
- How should log rotation or size limits be handled, if at all?
- Should logs include provider response bodies for failed requests, or redact them by default?

## Status

- What document count breakdown is required for useful diagnosis?
- Should status include storage path and log path?
- Should status include last scan time if scan state is currently not persisted?
- Should watcher state be reported only for running processes, or persisted where possible?

## Runtime Structure

- Should MCP stdio serving live in `src/interfaces/mcp/` only, or should app/runtime expose a transport-neutral serving hook?
- At what point should `app/runtime.ts` be split into smaller composition or workflow files?
- Should a future capability layer be introduced before P1 UI, or only when UI requirements make it necessary?

## Scan and Watch Follow-Up

- When should ambiguous watcher events trigger source rescan fallback?
- Should a future `SourceChangeSignal` replace the current `SourceFileEvent` type?
- Should a future SyncCoordinator own both scan and watcher signal orchestration?

