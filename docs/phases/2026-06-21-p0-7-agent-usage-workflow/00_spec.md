# P0.7 Agent Usage Workflow and Retrieval Evaluation Spec

## Goal

Evaluate how agents should use MindWeave retrieval in real workflows, and decide whether the current MCP tool contract is sufficient before adding more runtime features.

P0.5 proved MCP transport and agent-facing retrieval can work.
P0.6 improved operational diagnosis for real local use.
P0.7 should now evaluate the usage layer above the runtime:

```text
agent task
  -> decide whether to query MindWeave
  -> construct retrieval query
  -> inspect chunks and metadata
  -> answer or open source document for more context
```

## Positioning

This is an evaluation and workflow-design phase.

It should not start by adding runtime tools, HTTP transport, UI, or new source types. Runtime changes should be proposed only after the evaluation shows a concrete contract gap.

## Scope

In scope:

- define an agent-facing usage workflow for MindWeave
- create a small retrieval evaluation set over the current personal vault
- run the current retrieval path against the eval set
- review whether `search_knowledge` and `list_sources` are sufficient
- identify minimal follow-up contract changes if needed

Out of scope:

- implementing new MCP tools during this phase
- adding HTTP or network-port transport
- adding UI
- adding local embedding provider support
- changing chunking unless evaluation proves it is necessary
- expanding source types beyond Markdown

## Success Criteria

P0.7 is successful when it produces a concrete decision:

- keep the current tool contract unchanged, or
- add specific result metadata, or
- add a specific new tool, or
- only add agent workflow/skill guidance with no runtime change

The decision should be based on recorded eval results, not speculation.

## Evaluation Method

The eval set should include realistic user intents from the current vault:

- precise concept lookup
- fuzzy method discussion
- personal project or effort context
- source-level ambiguity
- daily-note or time-oriented lookup
- tool/workflow reference lookup

Each eval case should record:

- user intent
- query used
- expected document or source area
- top retrieved chunks
- whether expected content appeared in top results
- whether chunks were enough for an answer
- whether an agent would need to open the source file
- contract gaps observed

## Agent Workflow Principle

MindWeave should be the semantic first-pass retrieval layer, not the final reasoning layer.

Recommended agent loop:

```text
1. Decide whether the user intent likely needs personal/local knowledge.
2. Query MindWeave with a compact semantic query.
3. Inspect top chunks, scores, source identity, document identity, and URI.
4. If chunks are sufficient, answer with source-aware context.
5. If chunks identify the right document but are incomplete, open the source document.
6. If retrieval is weak or off-topic, revise the query or say local knowledge was insufficient.
```

Agents should not:

- treat scores as factual confidence
- assume top result is enough without reading the chunk
- use MindWeave as an answer generator
- query MindWeave for general knowledge unless personal context is likely useful

## Expected Output

This phase should produce:

- `01_agent_workflow.md`
- `02_eval_set.md`
- `03_eval_results.md`
- `04_contract_review.md`

Implementation work units should be created only if `04_contract_review.md` recommends runtime changes.
