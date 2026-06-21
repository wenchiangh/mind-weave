# sqlite-vec Vector Storage Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and implement the first SQLite vector storage slice using `better-sqlite3` plus the official `sqlite-vec` package.

**Architecture:** Vector storage remains inside `src/storage`. It should extend `SQLiteStorage` behind storage-owned domain operations and keep sqlite-vec details out of QueryService, indexing, CLI, and runtime adapters.

**Tech Stack:** TypeScript 7 beta native preview (`tsgo`), Vitest, `better-sqlite3`, official `sqlite-vec` npm package.

---

## Planning Standard

This plan describes implementation intent, boundaries, observable behavior, and validation criteria. It should allow implementation agents to produce logically consistent code without requiring exact code text.

## Source Documents

- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#11-storage-design`
- `docs/phases/2026-05-31-p0-core-mvp/03_detailed_design.md#13-query-design`
- `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`
- `docs/phases/2026-05-31-p0-core-mvp/work-units/07-sqlite-metadata-storage.md`

## Current Starting Point

WU-07 implemented `SQLiteStorage` with normal metadata tables:

- `sources`
- `documents`
- `chunks`
- `embeddings`
- `meta`
- `index_config`

WU-08 should add vector rows and vector search while preserving the parent chain:

```text
vec_embeddings -> embeddings -> chunks -> documents -> sources
```

## Non-Goals

- Do not implement QueryService.
- Do not implement query embedding.
- Do not call embedding providers.
- Do not implement MCP tools.
- Do not implement indexing pipeline.
- Do not implement hybrid search or reranking.
- Do not expose raw sqlite-vec SQL outside storage.
- Do not add JavaScript-side result filtering unless sqlite-vec proves SQL filtering impossible.

## Spike Questions

WU-08 must answer:

- Can `sqlite-vec` load into `better-sqlite3` in this project?
- What is the exact `vec0` table creation syntax for the selected package version?
- What is the exact KNN SQL shape?
- How should vectors be serialized for insert and query?
- Can metadata joins exclude deleted/failed parent rows in SQL?
- Can source filters be expressed in SQL around the KNN query?
- Is the initial score formula `1 / (1 + distance)` usable?

Record the answers in this work-unit document after implementation.

## Storage Behavior

WU-08 should add:

- sqlite-vec extension loading.
- `vec_embeddings` virtual table.
- vector row insert/update tied to embedding IDs.
- vector search returning `VectorSearchResult`.
- score normalization from raw distance.

Search must:

- Join vector rows back through `embeddings -> chunks -> documents -> sources`.
- Exclude deleted documents.
- Exclude failed documents.
- Exclude disabled sources.
- Include `indexed` and `stale` documents.
- Apply include/exclude source filters in SQL.
- Apply file type filter in SQL.
- Apply score threshold in SQL or in an outer SQL query over normalized score.
- Return at most `limit` rows.

WU-08 may overfetch inside SQL if sqlite-vec cannot push all filters into KNN directly. Any overfetch factor should be storage-internal and documented.

## Vector Relationship

Each vector row belongs to one embedding.

Rules:

- `embeddings.embedding_id` is the logical parent.
- `vec_embeddings.embedding_id` stores the same logical ID.
- WU-08 should enforce the relationship in `SQLiteStorage` writes.
- Orphan vector rows must not appear in search results because search joins back to active parent rows.

## File Responsibilities

Expected changes:

- `src/storage/sqlite.ts`
  - Load sqlite-vec.
  - Create `vec_embeddings`.
  - Add vector write behavior.
  - Implement `VectorSearchStore.searchVectors`.

- `src/storage/contracts.ts`
  - May add minimal vector write input if needed.
  - Keep vector search output narrow for WU-08.

- `src/storage/sqlite.test.ts`
  - Add integration tests for sqlite-vec load, insert, KNN, metadata join, status exclusion, source filters, file type filters, score threshold, and score normalization.

- `src/storage/index.ts`
  - Export any new storage types.

Existing docs:

- Update this work-unit plan with the final spike findings.

## Implementation Tasks

### Task 1: [x] Add sqlite-vec Dependency

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `pnpm-workspace.yaml` only if build approval is needed.

Plan:

- Add official `sqlite-vec`.
- Verify the package can be imported and loaded into `better-sqlite3`.

Validation:

- A focused test or small integration path can load sqlite-vec.
- If dependency install/load fails, mark WU-08 blocked and record the reason.

### Task 2: [x] Add Vector Table Schema

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Create `vec_embeddings` as a sqlite-vec virtual table.
- Keep normal metadata tables unchanged except for required vector write coordination.
- Avoid schema migration framework; early development can reset local DB if schema changes.

Validation:

- Temporary DB can create/open schema with sqlite-vec loaded.

### Task 3: [x] Implement Vector Writes

**Files:**

- Modify: `src/storage/contracts.ts`
- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Add a storage-domain method to write vectors for embedding records.
- Ensure vector row ownership matches `embeddings.embedding_id`.
- Ensure replacing document chunks also removes vector rows for old embeddings.

Validation:

- Tests cover vector insert and replacement cleanup.

### Task 4: [x] Implement KNN Search and Score Normalization

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Implement `searchVectors`.
- Use cosine distance if supported by selected sqlite-vec syntax; otherwise record actual metric behavior and adjust plan.
- Normalize score as `1 / (1 + distance)`.

Validation:

- Tests prove nearest vector ranking and normalized score ordering.

### Task 5: [x] Implement SQL Metadata Filtering

**Files:**

- Modify: `src/storage/sqlite.ts`
- Modify: `src/storage/sqlite.test.ts`

Plan:

- Join `vec_embeddings -> embeddings -> chunks -> documents -> sources`.
- Exclude deleted/failed documents and disabled sources.
- Apply source include/exclude filters.
- Apply file type filter.
- Apply score threshold.

Validation:

- Tests prove deleted/failed/disabled rows are excluded.
- Tests prove include/exclude source filters work.
- Tests prove file type and score threshold filters work.

### Task 6: [x] Record Spike Findings and Mark Passed

**Files:**

- Modify: this work-unit document.
- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

Plan:

- Record sqlite-vec load API, table syntax, vector serialization, KNN SQL shape, filtering decision, and score formula.
- Mark task checklist complete and WU-08 `passed` if validation succeeds.

Validation:

- `pnpm typecheck` passes.
- `pnpm test` passes.

## Success Check

WU-08 is successful only if:

- `sqlite-vec` loads in `better-sqlite3`.
- A temporary SQLite database can store vectors.
- KNN search returns nearest rows joined back to active metadata.
- Deleted/failed/disabled parent rows are excluded by SQL joins.
- Include/exclude source filters work.
- File type and score threshold filters work.
- Score is normalized to `0..1` with higher score being more relevant.
- Spike findings are recorded.
- `pnpm typecheck` passes.
- `pnpm test` passes.

## Recovery Notes

If execution is interrupted:

- If sqlite-vec is not installed or cannot load, resume at Task 1.
- If vector schema is missing, resume at Task 2.
- If vector writes are missing, resume at Task 3.
- If KNN search is missing, resume at Task 4.
- If SQL filtering is incomplete, resume at Task 5.
- If validation passes but findings/status are not recorded, resume at Task 6.

## Spike Findings

- Package: `sqlite-vec@0.1.9`.
- Load API: `import * as sqliteVec from "sqlite-vec"; sqliteVec.load(db)`.
- Extension check: `vec_version()` returns the loaded sqlite-vec version.
- Table syntax used by P0: `CREATE VIRTUAL TABLE vec_embeddings USING vec0(embedding float[N] distance_metric=cosine, embedding_id text)`.
- Vector serialization: pass JSON arrays through sqlite-vec's `vec_f32(?)` SQL helper.
- Insert shape: `INSERT INTO vec_embeddings (embedding, embedding_id) VALUES (vec_f32(?), ?)`.
- KNN shape: `SELECT embedding_id, distance FROM vec_embeddings WHERE embedding MATCH vec_f32(?) AND k = ?`.
- `vec0` primary key behavior: row IDs are integer-managed by sqlite-vec; P0 stores logical parent ownership in the `embedding_id` metadata column.
- Filtering decision: perform KNN in a SQL CTE with an internal overfetch factor, then join through `embeddings -> chunks -> documents -> sources` and apply status/source/file type/score filters in SQL.
- Score formula: `score = 1 / (1 + distance)`.
- Queryable document statuses: `indexed` and `stale`.
- Excluded by storage SQL: deleted documents, failed documents, and disabled sources.

## Plan Review Checklist

- [x] The plan is intention-oriented and does not include implementation templates.
- [x] The plan is limited to storage/vector behavior and excludes QueryService.
- [x] The plan requires real sqlite-vec validation rather than a mock.
- [x] The plan requires SQL metadata joins and filters.
- [x] The plan records spike findings before completion.
