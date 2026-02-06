# Feature: Gantt View

## Blueprint

### Context

The Gantt view renders a timeline-based visualization of the project's task schedule. Unlike traditional Gantt charts that require manual date entry, Partial's Gantt derives scheduling from the DAG — task positions are computed from dependency chains, durations (if specified), and completion state.

This is the primary view for understanding project timelines, identifying the critical path, and spotting bottlenecks in the dependency graph.

### Architecture

- **Source file:** `src/renderer/views/Gantt.svelte`
- **Visualization library:** D3.js
- **UI framework:** Svelte 5 (runes syntax)
- **Runs in:** Electron renderer process

**Component Contract:**

```typescript
interface GanttViewProps {
  plan: PlanFile
  dag: Graph
}
```

- **Data flow:** Receives `PlanFile` + computed `Graph` via props. Renders a D3-powered SVG timeline.
- **Dependencies:** DAG engine (`src/shared/dag.ts`), D3.js, `TaskCard` component
- **Dependents:** `App.svelte` (view switcher)

**Rendering pipeline:**
1. Receive `plan` + `dag` props
2. Compute topological order and critical path from DAG
3. Map tasks to horizontal bars on a time axis
4. Render dependency edges as connector lines
5. Highlight critical path tasks
6. Update reactively when `plan` changes (via `$derived`)

### Anti-Patterns

- **Manual DOM manipulation alongside Svelte** — Use D3 only for calculations (scales, layouts). Let Svelte own the DOM via `{#each}` blocks or bind D3 to an SVG element via `$effect`.
- **Re-rendering the entire chart on every change** — Use Svelte's reactivity to diff and update only changed tasks.
- **Hardcoded dimensions** — The chart must be responsive to container size. Use `ResizeObserver` or SVG viewBox.
- **Svelte 4 syntax** — Do not use `export let` or `$:` reactive declarations. Use `$props()`, `$state()`, `$derived()`.

## Contract

### Definition of Done

- [ ] Renders tasks as horizontal bars positioned by dependency order
- [ ] Draws dependency edges as connector lines between related tasks
- [ ] Highlights the critical path (longest dependency chain) visually
- [ ] Completed tasks (`done: true`) are visually distinct (muted/checked)
- [ ] Supports horizontal scrolling for projects exceeding viewport width
- [ ] Supports vertical scrolling for projects with many tasks
- [ ] Responsive to container resizing
- [ ] Updates reactively when `plan` prop changes (no full re-render)
- [ ] Uses Svelte 5 runes syntax exclusively
- [ ] Uses scoped Svelte styles (no CSS frameworks)
- [ ] Accessible: keyboard navigation for task selection, ARIA labels on chart elements

### Regression Guardrails

- Chart must render without errors for an empty task list
- Chart must handle tasks with no dependencies (shown at earliest position)
- D3 scales must not produce NaN or Infinity for edge cases
- No memory leaks from D3 selections or event listeners on component destroy

### Scenarios

**Scenario: Basic project timeline**
- Given: A plan with tasks A → B → C in a linear chain
- When: The Gantt view renders
- Then: Three bars appear left-to-right in dependency order with connector lines

**Scenario: Critical path highlighted**
- Given: A plan with two paths: A → B → D (3 tasks) and A → C → D (3 tasks), where B has longer duration
- When: The Gantt view renders
- Then: The A → B → D path is visually highlighted as the critical path

**Scenario: Completed tasks**
- Given: A plan where task A is `done: true` and task B is `done: false`
- When: The Gantt view renders
- Then: Task A appears muted/checked, task B appears in active styling

**Scenario: Empty plan**
- Given: A plan with `tasks: []`
- When: The Gantt view renders
- Then: An empty state message or placeholder is shown (no errors)

**Scenario: Reactive update**
- Given: The Gantt view is rendered with 3 tasks
- When: A new task is added to the plan (via file watcher update)
- Then: The chart updates to show 4 tasks without a full re-render
