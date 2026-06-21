# P0.7 Agent Usage Workflow Execution Index

This document tracks the P0.7 evaluation phase.

## Work Units

## WU-00 Phase Definition

- [x] Status: `passed`
- Scope:
  - Define the agent usage workflow and retrieval evaluation phase.
  - Keep this as an evaluation phase, not a runtime implementation phase.
- Observable result:
  - `00_spec.md`

## WU-01 Agent Workflow

- [x] Status: `passed`
- Scope:
  - Define when agents should query MindWeave.
  - Define how agents should interpret results.
  - Define when agents should open source documents.
- Observable result:
  - `01_agent_workflow.md`

## WU-02 Retrieval Eval Set

- [x] Status: `passed`
- Scope:
  - Create a small realistic eval set over the current personal vault.
- Observable result:
  - `02_eval_set.md`

## WU-03 Eval Execution

- [x] Status: `passed`
- Scope:
  - Run current retrieval over the eval set.
  - Record top result behavior and observed gaps.
- Observable result:
  - `03_eval_results.md`

## WU-04 Contract Review

- [x] Status: `passed`
- Scope:
  - Decide whether the current MCP contract needs changes.
- Observable result:
  - `04_contract_review.md`

## Recommended Follow-Up

Create a focused implementation phase for retrieval result metadata:

- `relativePath`
- `chunkIndex`
- Markdown `headingPath`

No new MCP tool is recommended yet.
