# P0 Core MVP Open Questions

These questions are not blockers for the high-level architecture, but they should be answered during detailed design.

## Configuration

- What exact config file format should P0 use: JSON, JSONC, YAML, or TOML?
- Should source IDs be user-provided, generated, or both?
- Should source configuration live only in the config file during P0, or should it also be mirrored in SQLite?

## Markdown Processing

- Which Markdown parsing or chunking library should be used?
- What default max chunk size should P0 use?
- What default overlap should P0 use?
- Should heading path be embedded as text, returned only as metadata, or both?
- Which frontmatter fields should be extracted in P0?

## Identity

- What exact document ID rule should be used?
- What exact chunk ID rule should be used?
- Should document ID change when a file moves, or should move detection be introduced later?

## Storage

- What exact SQLite schema should be used?
- What sqlite-vec schema and distance metric should be used?
- How should schema migrations be represented?
- What cleanup policy should eventually hard delete soft-deleted records?

## Embeddings

- What batch size should be the default?
- What retry and backoff defaults should be used?
- Should dimensions be required only for providers that need them?
- How should provider failures be represented in document and job status?

## Query

- What score normalization formula should be used for the selected sqlite-vec distance metric?
- What should the default result limit be?
- What should the default score threshold be, if any?
- Should failed or stale documents ever be queryable through explicit options?

## MCP

- What exact input schema should `search_knowledge` use?
- What exact output schema should MCP return?
- Should `list_sources` be included in P0 or only after `search_knowledge` works?
- Should `get_chunk` be included in P0 or deferred?

## Watcher

- Which file watching library should P0 use?
- What debounce default should be used?
- Should scheduled scan be enabled by default?
- What default scheduled scan interval is acceptable for personal knowledge use?

## Product Shell

- Should Tauri communicate with Core through local HTTP, stdio, or another IPC mechanism?
- How should the Node sidecar be packaged?
- Should the UI edit the config file directly or call a Core configuration API?
