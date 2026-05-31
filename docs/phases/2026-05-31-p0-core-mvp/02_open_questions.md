# P0 Core MVP Open Questions

These questions remain after detailed design. They are not blockers for the high-level architecture, and most can be answered during implementation spikes.

## Configuration

- What exact JSONC parser and validation library should be used?
- What should the default config file path be?
- What should the exact `reset-index` command shape be?

## Markdown Processing

- Which Markdown parsing or chunking library should be used?
- Should frontmatter be ignored entirely, or stripped from chunk text while retained as document metadata?
- What exact chunk text format should be used when adding heading context?

## Identity

- What normalized path rules should be used across macOS and future platforms?
- Should generated source IDs be written back into config later, or only derived at runtime?

## Storage

- What exact SQLite schema should be used?
- Can sqlite-vec support the required filtered KNN shape directly, or does `SQLiteStorage` need SQL overfetch as an implementation detail?
- Does sqlite-vec need denormalized metadata columns for practical filtered search?
- What exact score normalization formula should be used with the selected distance metric?
- What should the manual maintenance command shape be?

## Embeddings

- What retry backoff schedule should be used for transient provider errors?
- What error taxonomy should adapters expose for provider configuration, auth, rate limit, and transient failures?

## Query

- Should failed or stale documents ever be queryable through explicit options?
- Should QueryService expose debug fields behind an internal flag during development?

## MCP

- Which MCP TypeScript SDK package and transport should be used first?
- What exact runtime config flag should control MCP startup behavior?

## Watcher

- Which file watching library should P0 use?
- What filesystem events should be normalized into upsert/delete jobs for the chosen watcher library?
- How should watcher errors be surfaced in status and logs?

## Product Shell

- Should Tauri communicate with Core through local HTTP, stdio, or another IPC mechanism?
- How should the Node sidecar be packaged?
- Should the UI edit the config file directly or call a Core configuration API?
