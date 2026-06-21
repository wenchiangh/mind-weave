# Retrieval Eval Set

This eval set uses the current dogfooding vault configuration.

The purpose is to evaluate whether the existing retrieval contract supports agent usage, not to benchmark embedding models generally.

## Cases

| ID | User Intent | Query Used | Expected Area | Success Criteria |
| --- | --- | --- | --- | --- |
| `js-equality` | Discuss JavaScript equality behavior. | `JavaScript equality SameValue Object.is === == type conversion` | `20_Atlas/Computing/JavaScript/03_Type Conversion and Equality.md` | Top result distinguishes `===`, `==`, and `Object.is`. |
| `dp-solving-method` | Discuss DP solving methods and techniques. | `dynamic programming DP solving patterns state transition recurrence memoization` | `20_Atlas/Computing/Solving Patterns.md` | Top results include DP state/transition and memoization chunks. |
| `redis-persistence` | Explain Redis persistence tradeoffs. | `Redis persistence RDB AOF cache durability tradeoffs` | `20_Atlas/Computing/Redis.md` | Top results include RDB/AOF persistence chunks. |
| `boundary-aware-ai-coding` | Discuss AI coding change boundary governance. | `boundary aware change governance AI coding expected change boundary actual change surface` | `10_Efforts/AI/Boundary-Aware Change Governance for AI Coding.md` | Top results include expected boundary, actual surface, or boundary deviation chunks. |
| `agent-context-quality` | Discuss evaluating agent context quality. | `evaluate agent context quality AI coding context boundaries signal noise` | `10_Efforts/AI/Evaluating Agent Context Quality.md` | Top results include evaluation-loop or context-quality chunks. |
| `promise-async` | Discuss Promise and async/await execution. | `JavaScript Promise async await serial concurrent execution` | `20_Atlas/Computing/JavaScript/10_Promise and Async.md` | Top result covers serial/concurrent execution or async semantics. |
| `react-reconciliation` | Discuss React reconciliation in the build-your-own-React notes. | `React reconciliation fibers render commit build your own React` | `20_Atlas/Computing/React/Build your own React/06 Reconciliation.md` | Expected document appears in top 5; agent can decide whether to open source for broader context. |
| `trie-prefix` | Discuss Trie prefix matching. | `Trie prefix tree string retrieval autocomplete prefix matching` | `20_Atlas/Computing/Data Structures/Trie.md` | Top results include Trie applications and prefix model. |
| `leetcode-review` | Discuss Leetcode review priorities. | `Leetcode review plan core algorithms sliding window DP trie heap` | `10_Efforts/Work/Leetcode.md` | Top results include Leetcode review plan chunks. |
| `english-learning` | Discuss English IELTS half-week learning plan. | `English IELTS learning plan half week vocabulary speaking writing` | `10_Efforts/English/001_Half Week 1.md` | Half-week plan appears in top results; broader English plan may rank above it. |
| `daily-recent-ai` | Find daily-note context about AI coding work progress. | `daily notes AI coding work progress June 2026` | `00_Daily` | Daily notes appear, but result quality determines whether source/date filters are needed. |
| `tools-digital-toolbox` | Find personal digital toolbox notes. | `digital toolbox tools workflow personal knowledge software` | `20_Atlas/Tools/Digital Toolbox.md` | Top results include Digital Toolbox chunks. |

## Evaluation Rules

For each case:

- record top 5 result paths and scores
- mark whether expected content appears in top 1 and top 5
- mark whether returned chunks are enough for a reasonable answer
- record whether opening the source document would be needed
- record contract gaps
