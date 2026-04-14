export const promptTemplate = `You are analyzing SQLite query performance.

You will receive one or more query metric objects. For each query, use:

- SQL text
- cumulative timing metrics
- max single-run latency
- EXPLAIN QUERY PLAN rows
- sqlite3_stmt_status counters

Your job is to identify the most likely causes of slowness and propose concrete
fixes.

Important SQLite interpretation rules:

1. EXPLAIN QUERY PLAN is a tree encoded as rows with:
   - id: node id
   - parent: parent node id
   - detail: human-readable plan detail
2. Treat the EQP detail text as advisory, not as a perfectly stable machine
   interface.
3. Meanings to use:
   - SCAN usually means a full scan or full traversal
   - SEARCH usually means indexed subset access
   - USING COVERING INDEX is generally better than non-covering index access
   - USE TEMP B-TREE FOR ORDER BY / GROUP BY / DISTINCT usually means extra
     sorting or temp work
   - SCALAR SUBQUERY / CORRELATED SCALAR SUBQUERY / MATERIALIZE / CO-ROUTINE can
     indicate extra execution layers or repeated work
   - MULTI-INDEX OR can be valid, but may still be expensive depending on
     cardinality and repetitions
4. Meanings of sqlite3_stmt_status counters:
   - fullscanStep: number of forward steps in full table scans; high values
     often suggest missing or ineffective indexes
   - sort: number of sort operations; non-zero may suggest missing index support
     for ORDER BY / GROUP BY / DISTINCT
   - autoindex: rows inserted into transient automatic indexes; non-zero may
     suggest a permanent index should exist
   - vmStep: proxy for total work done by the prepared statement
   - reprepare: statement was automatically regenerated due to schema changes or
     parameter changes that affect the plan
   - run: number of statement runs
   - filterHit / filterMiss: Bloom filter counters for joins; usually secondary
     diagnostics, not primary optimization targets
5. Be careful:
   - Do not claim certainty from EQP text alone
   - Do not recommend indexes that duplicate an obviously existing useful index
     unless you explain why
   - Distinguish between “high total cost because it runs often” and “high
     single-run latency”
   - Prefer practical, minimal index suggestions over speculative rewrites
   - If the query already appears well-indexed, say that and focus on workload
     frequency, result size, or query shape

For each query, produce:

1. Summary
   - one sentence on why this query matters
   - classify it as primarily:
     - high frequency
     - high single-run latency
     - heavy scan work
     - sort/temp-btree heavy
     - join/index issue
     - subquery/correlation issue
2. Evidence
   - cite the most relevant metrics and EQP nodes
   - explicitly mention which plan rows matter
3. Likely causes
   - explain the top 1 to 3 causes
4. Suggested fixes
   - propose concrete indexes in SQL when justified
   - propose query rewrites when justified
   - propose schema/query-shape changes only when supported by evidence
5. Confidence
   - High / Medium / Low
   - explain what additional info would confirm the diagnosis
6. Priority
   - rank the query as P1 / P2 / P3 for optimization effort

Index recommendation rules:

- If EQP shows SCAN on a filtered table and fullscanStep is high, consider an
  index on the WHERE columns in filter order.
- If EQP shows USE TEMP B-TREE FOR ORDER BY and the query filters first,
  consider an index starting with selective WHERE columns followed by ORDER BY
  columns.
- If EQP shows USE TEMP B-TREE FOR GROUP BY or DISTINCT, consider an index that
  matches the grouping/distinct keys if it fits the query shape.
- If autoindex is non-zero for joins, suggest a permanent index on the join key
  columns.
- If a correlated subquery appears and the query runs many times or max latency
  is high, consider rewriting to JOIN / EXISTS / pre-aggregation when
  semantically safe.
- Always mention tradeoffs: extra indexes improve reads but increase write cost
  and storage.

Output format: Return valid markdown with these sections:

## Top optimization opportunities

A short ranked list across all queries.

## Query analysis

For each query:

### Query N

- Summary:
- Evidence:
- Likely causes:
- Suggested fixes:
- Example index SQL:
- Example rewrite:
- Confidence:
- Priority:

When you suggest an index, use a concrete CREATE INDEX statement if the target
columns are inferable. When the columns are not inferable with confidence,
describe the desired index pattern instead of inventing names. When no strong
optimization is justified, say so.

Now analyze this data:

{{QUERY_METRICS_JSON}}
`
