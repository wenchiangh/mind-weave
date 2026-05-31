# MindWeave Product Brief

## Positioning

MindWeave is a local-first knowledge connector for AI agents.

It turns existing local knowledge sources into a searchable retrieval layer that agents can query through stable interfaces. The product does not try to replace note-taking tools, document editors, code editors, chat applications, or agent workflows. It runs beside them and makes existing knowledge easier for agents to access.

The core product value is the connection layer:

```text
Existing local knowledge
  -> indexed semantic chunks
  -> agent-accessible retrieval
```

## Target User

The first user is the project owner.

The broader target user is a local-first knowledge worker who has accumulated substantial personal or project knowledge in local files and wants AI agents to access it without moving that knowledge into a new application.

Typical knowledge sources include:

- Markdown notes.
- Obsidian vaults.
- Project documentation.
- Local research notes.
- Workflow documents.

In the first version, Obsidian vaults are treated as ordinary folders of Markdown files.

## Primary Consumer

The primary runtime consumer is an agent, not a human user.

Humans configure sources and inspect system state. Agents issue semantic retrieval queries and receive relevant chunks with metadata.

This product shape leads to a different design from chat-based knowledge tools:

- The main experience is not a chat window.
- The query interface should be agent-facing first.
- Retrieval results should be explicit and traceable.
- Users should not need to change their current workflow.

## Core Value

MindWeave should provide a better path than letting agents explore local files directly.

Direct file exploration can be slow, token-heavy, and inconsistent. MindWeave improves this by pre-processing configured local documents into searchable chunks and returning focused results when queried.

The system should provide:

- Automatic discovery of configured local knowledge.
- Incremental indexing through scans and file events.
- RAG-based semantic retrieval.
- Source metadata for traceability.
- Interface adapters for agents and future UI surfaces.

## Product Shape

MindWeave is a workflow enhancement layer.

Users continue using their existing tools:

- Obsidian or Markdown editors for notes.
- Repositories and editors for project work.
- Codex, Claude Code, Cursor, or other agents for AI-assisted workflows.

MindWeave sits between these tools:

```text
User files
  -> MindWeave Core
  -> MCP / CLI / UI / future adapters
  -> agent workflows
```

The UI exists to configure and observe the system. It should not become the main knowledge consumption flow in the first product version.

## Retrieval Contract

MindWeave returns retrieval results, not generated answers.

A query result should include:

- Chunk text.
- Retrieval score.
- Source identity.
- Document identity.
- File path or URI.
- Heading path when available.
- Source update time.
- Index time.
- Additional metadata.

The score represents retrieval relevance. It does not guarantee factual correctness, completeness, freshness beyond the latest successful index, or usefulness for the current agent task.

Upper-level agent workflows decide:

- When to query MindWeave.
- How to form the query.
- Whether results are useful.
- How to apply returned chunks to the task.

## Product Phasing

The project should start with a core runtime before a product shell.

P0 focuses on the TypeScript core:

- Local Markdown discovery.
- Indexing.
- Embedding.
- Storage.
- Query.
- MCP access.

P1 adds a simple macOS taskbar app:

- Source configuration.
- Status display.
- Open file actions.
- Open log folder actions.

This keeps the product grounded in the knowledge connection layer while still allowing a good local desktop experience.
