# Feature: Kanban View

## Blueprint

### Context

The Kanban view presents tasks as cards organized into columns by state. While the Gantt view focuses on time and dependencies, the Kanban view focuses on workflow — what's blocked, what's in progress, and what's done.

Column assignment is derived from task properties, not manual drag operations (though drag-to-change-state is a future goal). The view reads the DAG to determine which tasks are blocked vs. unblocked, creating a natural workflow pipeline.

### Architecture

- **Source file:** `src/renderer/views/Kanban.svelte`
- **UI framework:** Svelte 5 (runes syntax)
- **Runs in:** Electron renderer process

**Component Contract:**

```typescript
interface KanbanViewProps {
  plan: PlanFile
  dag: Graph
}
```

**Column Logic:**

| Column | Condition |
|--------|-----------|
| **Blocked** | Task has unfinished dependencies |
| **Ready** | All dependencies satisfied, `done: false` |
| **In Progress** | `state: "in_progress"` (extended field) |
| **Done** | `done: true` |

- **Data flow:** Receives `PlanFile` + `Graph`, computes column assignment via `$derived`, renders `TaskCard` components.
- **Dependencies:** DAG engine (`getUnblockedTasks`), `TaskCard` component
- **Dependents:** `App.svelte` (view switcher)

### Anti-Patterns

- **Hardcoded column names** — Column definitions should be derivable from task state, not hardcoded strings that break when the schema evolves.
- **Ignoring the DAG for blocked status** — Don't check `needs` arrays manually. Use `getUnblockedTasks` from the DAG engine to determine blocked/ready state.
- **Heavy DOM updates on every plan change** — Use Svelte's keyed `{#each}` blocks to minimize DOM churn when tasks move between columns.
- **Svelte 4 syntax** — Do not use `export let` or `$:` reactive declarations.

## Contract

### Definition of Done

- [ ] Renders tasks grouped into columns based on state (Blocked, Ready, In Progress, Done)
- [ ] Uses DAG engine to determine blocked vs. ready status
- [ ] Each task renders as a `TaskCard` component
- [ ] Columns update reactively when `plan` prop changes
- [ ] Shows task count per column
- [ ] Handles the `state` extended field for "in_progress" differentiation
- [ ] Empty columns are visually minimized/collapsed with an expand affordance (v0.2.0 change)
- [ ] "In Progress" column header has a tooltip explaining the `state` field
- [ ] Uses Svelte 5 runes syntax exclusively
- [ ] Uses scoped Svelte styles (no CSS frameworks)
- [ ] Accessible: tasks are focusable, columns are labeled with ARIA roles

### Regression Guardrails

- A task must appear in exactly one column (no duplicates, no missing)
- Column assignment must be consistent with DAG engine's `getUnblockedTasks`
- View must not error on empty plans
- View must handle tasks with no dependencies (appear in Ready or Done)

### Scenarios

**Scenario: Tasks distributed across columns**
- Given: A plan with task A (done), B needs A (not done), C needs B (not done), D (not done, no deps)
- When: The Kanban view renders
- Then: A is in "Done", B is in "Ready" (A is done), C is in "Blocked" (B not done), D is in "Ready"

**Scenario: All tasks done**
- Given: A plan where every task has `done: true`
- When: The Kanban view renders
- Then: All tasks appear in the "Done" column; other columns are visually minimized/collapsed

**Scenario: Empty plan**
- Given: A plan with `tasks: []`
- When: The Kanban view renders
- Then: All columns render with zero-count headers and empty placeholders

**Scenario: Task with in_progress state**
- Given: A task with `state: "in_progress"` and `done: false`, all dependencies satisfied
- When: The Kanban view renders
- Then: The task appears in the "In Progress" column, not "Ready"

**Scenario: Reactive update — task completed**
- Given: The Kanban view shows task B in "Ready"
- When: The plan updates with B now `done: true`
- Then: B moves to the "Done" column reactively
