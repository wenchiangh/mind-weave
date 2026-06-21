# Retrieval Eval Results

Evaluation date: 2026-06-21

Runtime:

- source: current dogfooding Obsidian vault
- provider: OpenAI-compatible `openai/text-embedding-3-small`
- command path: runtime query through current CLI/runtime stack
- indexed state before eval: 73 documents, 620 chunks, 620 embeddings

## Summary

| ID | Top 1 Expected? | Top 5 Expected? | Chunk Enough? | Source Open Needed? | Notes |
| --- | --- | --- | --- | --- | --- |
| `js-equality` | yes | yes | yes | no | Strong retrieval. |
| `dp-solving-method` | yes | yes | yes | no | Strong retrieval; top 4 chunks form a coherent answer. |
| `redis-persistence` | yes | yes | yes | no | Strong retrieval. |
| `boundary-aware-ai-coding` | yes | yes | yes | no | Strong retrieval. |
| `agent-context-quality` | yes | yes | yes | no | Strong retrieval. |
| `promise-async` | yes | yes | yes | no | Strong retrieval. |
| `react-reconciliation` | no | yes | partial | likely | Broad overview note ranked above the specific reconciliation file. |
| `trie-prefix` | yes | yes | yes | no | Strong retrieval. |
| `leetcode-review` | yes | yes | partial | likely | Top chunks identify the right plan, but a source open may help for full review order. |
| `english-learning` | no | yes | partial | likely | Broad English plan ranked above half-week note. |
| `daily-recent-ai` | no | yes | no | yes | Ambiguous time-oriented query needs better filtering or query strategy. |
| `tools-digital-toolbox` | yes | yes | yes | no | Strong retrieval. |

Overall:

- top 1 expected: 9 / 12
- top 5 expected: 12 / 12
- chunks enough without opening source: 8 / 12

## Case Notes

### `js-equality`

Top result:

- score `0.744`
- `20_Atlas/Computing/JavaScript/03_Type Conversion and Equality.md`

The top chunk directly contained strict equality, abstract equality, and `Object.is` distinctions.

Decision: current contract is enough.

### `dp-solving-method`

Top result:

- score `0.722`
- `20_Atlas/Computing/Solving Patterns.md`

Top chunks covered state/transition, memoized search, common DP types, and the DP applicability signal.

Decision: current contract is enough.

### `redis-persistence`

Top result:

- score `0.787`
- `20_Atlas/Computing/Redis.md`

Top chunks cleanly covered RDB, AOF, and persistence boundaries.

Decision: current contract is enough.

### `boundary-aware-ai-coding`

Top result:

- score `0.800`
- `10_Efforts/AI/Boundary-Aware Change Governance for AI Coding.md`

Top chunks were all from the expected note and covered boundary deviation, actual surface, expected boundary, and workflow.

Decision: current contract is enough.

### `agent-context-quality`

Top result:

- score `0.714`
- `10_Efforts/AI/Evaluating Agent Context Quality.md`

Top chunks were all from the expected note.

Decision: current contract is enough.

### `promise-async`

Top result:

- score `0.744`
- `20_Atlas/Computing/JavaScript/10_Promise and Async.md`

Top chunks covered serial/concurrent execution, microtasks, async patterns, async/await, and Promise composition.

Decision: current contract is enough.

### `react-reconciliation`

Top results:

- score `0.719`, `20_Atlas/Computing/React/Build your own React/Build your own React.md`
- score `0.701`, `20_Atlas/Computing/React/Build your own React/06 Reconciliation.md`

The expected document appeared in top 5 but not top 1. This is acceptable because the broad index note is semantically related, but the agent would benefit from clearer path and heading metadata.

Decision: current retrieval works, but result metadata should improve.

### `trie-prefix`

Top result:

- score `0.735`
- `20_Atlas/Computing/Data Structures/Trie.md`

Top chunks covered applications, shared prefixes, and path-as-prefix model.

Decision: current contract is enough.

### `leetcode-review`

Top result:

- score `0.661`
- `10_Efforts/Work/Leetcode.md`

The right document ranked first. Returned chunks identify the review plan, but a full answer about the complete review sequence may need opening the source file.

Decision: current retrieval works; source-open workflow remains useful.

### `english-learning`

Top results:

- score `0.754`, `10_Efforts/English/000_English Learning Plan IELTS 6.5.md`
- score `0.724`, `10_Efforts/English/001_Half Week 1.md`

The broader plan ranked above the half-week plan. This is reasonable for the query, but it shows that agents need to refine queries when the user wants a specific plan granularity.

Decision: workflow guidance is more important than a runtime change.

### `daily-recent-ai`

Top results:

- score `0.652`, `10_Efforts/AI/Boundary-Aware Change Governance for AI Coding.md`
- score `0.645`, `00_Daily/2026/2026-02/2026-02-28.md`
- score `0.645`, `00_Daily/2026/2026-04/2026-04-26.md`

The query asked for daily-note context, but topic notes competed with Daily notes. This exposes a workflow issue: time-oriented or source-area intents need source/path filtering or query rewriting. Current MCP supports source filtering but not path-prefix filtering.

Decision: no immediate new tool, but contract review should consider metadata/filter improvements.

### `tools-digital-toolbox`

Top result:

- score `0.728`
- `20_Atlas/Tools/Digital Toolbox.md`

Top chunks cleanly matched the expected note.

Decision: current contract is enough.

## Observations

The current retrieval path is strong for topic and effort notes.

The weak spots are not transport or vector search. They are agent ergonomics:

- source/path granularity matters for daily-note and hierarchical-note intents
- result metadata should make document location and chunk position easier to inspect
- broad overview files can rank above specific subtopic files, which is not necessarily wrong
- opening source documents remains part of the expected workflow for long plan or hierarchy questions
