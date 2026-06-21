# Local Usage Guide

This guide records the current local dogfooding workflow for MindWeave.

It assumes P0.6 or later runtime behavior.

## 1. Configure Local Knowledge

Example config:

```jsonc
{
  "sources": [
    {
      "type": "local-fs",
      "id": "notebook",
      "name": "Wen-Chiang Notebook",
      "rootPath": "/Users/wenchiangh/Library/Mobile Documents/iCloud~md~obsidian/Documents/Wen-Chiang's Notebook",
      "exclude": [
        "^(02_Zettel|03_Atlas|04_Projects)(/|$)",
        "^(90_Archive|90_Assets|99_Extras)(/|$)",
        "^(AGENT|Welcome)\\.md$"
      ]
    }
  ],
  "embedding": {
    "provider": "openai-compatible",
    "model": "openai/text-embedding-3-small",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKeyEnv": "OPENROUTER_API_KEY",
    "dimensions": 1536,
    "batchSize": 16
  },
  "storage": {
    "type": "sqlite",
    "path": "/Users/wenchiangh/.config/mindweave/mindweave.sqlite"
  },
  "mcp": {
    "enabled": true
  }
}
```

Do not put API keys in the config file. Put them in the environment variable named by `embedding.apiKeyEnv`.

Example:

```bash
export OPENROUTER_API_KEY="..."
```

## 2. Inspect Source Before Indexing

Run:

```bash
pnpm cli inspect --config ~/.config/mindweave/config.json
```

Use this before first indexing or after changing exclude rules.

The output reports:

- configured source id and root URI
- included Markdown document count
- skipped path counts
- top-level path counts
- sample included paths
- sample excluded paths

This command is read-only. It does not write to storage and does not call the embedding provider.

## 3. Check Runtime Status

Run:

```bash
pnpm cli status --config ~/.config/mindweave/config.json
```

Use status to check:

- configured sources
- embedding provider and model
- API key environment readiness
- storage path
- log path
- document status counts
- chunk count
- embedding count
- source-level document counts

Status is read-only. It does not scan, watch, serve MCP, or call embedding APIs.

## 4. Build or Refresh the Index

Run:

```bash
pnpm cli scan --config ~/.config/mindweave/config.json
```

`scan` performs one-shot index convergence:

```text
source discovery
  -> document upsert/delete reconciliation
  -> Markdown processing
  -> embedding
  -> SQLite/sqlite-vec writes
```

P0.6 scan prints structured JSON lines. Progress lines look like:

```json
{"event":{"type":"scan.started","sourceCount":1}}
{"event":{"type":"source.scan.started","sourceId":"notebook"}}
{"event":{"type":"source.scan.finished","sourceId":"notebook","candidateCount":73}}
{"event":{"type":"scan.finished","sourceCount":1,"discoveredDocumentCount":73}}
{"status":"scanned"}
```

Progress is coarse-grained. It is meant to confirm that long scans are moving, not to provide an exact percentage.

## 5. Query Locally

Run:

```bash
pnpm cli query --config ~/.config/mindweave/config.json "dynamic programming state transition"
```

The query result contains retrieval chunks and metadata. It does not contain generated answers.

The calling model or agent should decide whether the returned chunks are enough.

## 6. Serve MCP

Run:

```bash
pnpm cli mcp --config ~/.config/mindweave/config.json
```

`mcp` serves the current index over stdio. It does not scan or start watchers implicitly.

Use it when an agent client is responsible for process startup and wants retrieval over the existing index.

Example MCP client command shape:

```json
{
  "command": "pnpm",
  "args": [
    "cli",
    "mcp",
    "--config",
    "/Users/wenchiangh/.config/mindweave/config.json"
  ],
  "env": {
    "OPENROUTER_API_KEY": "..."
  }
}
```

The exact MCP client config file depends on the agent application.

## 7. Start Local Agent Workflow

Run:

```bash
pnpm cli start --config ~/.config/mindweave/config.json
```

`start` is the recommended local agent workflow when MindWeave owns the process:

```text
scan
  -> watch
  -> MCP stdio serving
```

Use `watch` only when you want scan/watch behavior without MCP:

```bash
pnpm cli watch --config ~/.config/mindweave/config.json
```

## 8. Recommended Agent Workflow

Agents should use MindWeave as a semantic entry point, not as an answer generator.

Recommended flow:

```text
search_knowledge
  -> inspect returned chunks and metadata
  -> answer if the chunks are enough
  -> open source documents only when broader context is needed
```

This keeps the retrieval layer narrow while still letting stronger agents use direct file access when needed.

## 9. Score Interpretation

`score` is a retrieval ranking signal.

It is useful for:

- ordering results
- coarse thresholding
- identifying obviously weak retrieval

It is not:

- answer confidence
- source truthfulness
- freshness guarantee
- a percentage grade

In local Markdown dogfooding, useful top results often appeared around `0.68` to `0.74`. Start with a low threshold or no threshold, inspect results, then tune per source and use case.
