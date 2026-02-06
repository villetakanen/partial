# Feature: DAG Engine

## Blueprint

### Context

Projects in Partial are directed acyclic graphs (DAGs) of tasks, not flat lists. The DAG engine takes a parsed `PlanFile` and constructs a dependency graph that powers every downstream feature: Gantt scheduling, Kanban column assignment, critical path highlighting, and CLI queries like "what's unblocked?"

The engine must be fast (sub-millisecond for typical project sizes of <500 tasks), correct (cycle detection is mandatory), and deterministic (same input always produces the same graph).

### Architecture

- **Source file:** `src/shared/dag.ts`
- **Graph library:** `graphlib`
- **Type definitions:** `src/shared/types.ts`

**API Contract:**

```typescript
/** Build a DAG from a PlanFile's task list and dependency edges */
function buildDAG(tasks: Task[]): Graph

/** Detect cycles in the graph. Returns the cycle path or null */
function detectCycles(graph: Graph): string[] | null

/** Return tasks in topological order (respecting dependencies) */
function topologicalSort(graph: Graph): Task[]

/** Return tasks with no unfinished dependencies */
function getUnblockedTasks(graph: Graph, tasks: Task[]): Task[]

/** Compute the critical path (longest dependency chain) */
function criticalPath(graph: Graph): Task[]
```

- **Dependencies:** `graphlib`, shared types
- **Dependents:** Gantt view (scheduling), Kanban view (state resolution), Graph view (visualization), CLI (`unblocked`, `graph` commands)

### Anti-Patterns

- **Silently ignoring cycles** — Cycles must be detected and reported with the full cycle path. Never silently skip edges to "fix" a cycle.
- **Mutating the PlanFile** — The DAG engine reads tasks but must never modify the source `PlanFile` object. Build a separate graph structure.
- **Assuming task order** — Tasks in the `.plan` file are unordered. The DAG defines order through explicit `needs` edges only.
- **Ignoring dependency types** — All four types (`fs`, `ss`, `ff`, `sf`) carry different scheduling semantics. Don't treat them as identical.

## Contract

### Definition of Done

- [ ] `buildDAG` constructs a graph from task `needs` and `needs_*` fields
- [ ] `detectCycles` returns the cycle path for cyclic graphs, `null` for acyclic
- [ ] `topologicalSort` returns a valid topological ordering
- [ ] `getUnblockedTasks` correctly filters to tasks whose dependencies are all `done: true`
- [ ] `criticalPath` identifies the longest chain of dependent tasks
- [ ] All four dependency types (`fs`, `ss`, `ff`, `sf`) produce edges with correct type metadata
- [ ] Tasks referencing non-existent dependency IDs produce a clear error
- [ ] Performance: <1ms for 500 tasks with typical dependency density
- [ ] All exported functions have JSDoc comments
- [ ] Test coverage >= 90%

### Regression Guardrails

- Cycle detection must never produce false negatives (missing a real cycle)
- Topological sort must be deterministic for identical inputs
- Graph construction must handle disconnected subgraphs (tasks with no dependencies)
- Parent-child relationships (`parent` field) must not be confused with dependency edges (`needs`)

### Scenarios

**Scenario: Linear chain**
- Given: Tasks A → B → C (each needs the previous)
- When: DAG is built and topologically sorted
- Then: Order is [A, B, C]

**Scenario: Diamond dependency**
- Given: A → B, A → C, B → D, C → D
- When: DAG is built and topologically sorted
- Then: A comes first, D comes last, B and C are between them (order between B/C is stable but either is valid)

**Scenario: Cycle detected**
- Given: A → B → C → A
- When: `detectCycles` is called
- Then: Returns `["A", "B", "C", "A"]` (or equivalent cycle representation)

**Scenario: Unblocked tasks**
- Given: A (done), B needs A (not done), C (not done, no deps), D needs B (not done)
- When: `getUnblockedTasks` is called
- Then: Returns [B, C] — B is unblocked because A is done; C has no dependencies

**Scenario: Disconnected subgraphs**
- Given: Tasks A → B and C → D with no connection between the two chains
- When: DAG is built
- Then: Both subgraphs are present; topological sort includes all four tasks

**Scenario: Missing dependency reference**
- Given: Task A has `needs: ["nonexistent-task"]`
- When: `buildDAG` is called
- Then: An error is raised identifying the broken reference
