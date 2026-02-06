# Feature: Graph View

## Blueprint

### Context

The Graph view renders an interactive force-directed visualization of the project's dependency DAG. While the Gantt and Kanban views present derived views of the graph, the Graph view shows the raw topology — nodes for tasks, edges for dependencies — giving users direct insight into the structure of their project.

This is the primary view for understanding and debugging dependency relationships, spotting isolated tasks, identifying bottlenecks (high fan-in nodes), and verifying the overall project structure.

### Architecture

- **Source file:** `src/renderer/views/Graph.svelte`
- **Visualization library:** D3.js (force simulation)
- **UI framework:** Svelte 5 (runes syntax)
- **Runs in:** Electron renderer process

**Component Contract:**

```typescript
interface GraphViewProps {
  plan: PlanFile
  dag: Graph
}
```

**Rendering pipeline:**
1. Receive `plan` + `dag` props
2. Map tasks to D3 force simulation nodes
3. Map dependency edges to D3 force simulation links
4. Run force simulation (charge repulsion, link distance, centering)
5. Render nodes as circles/rects with labels, edges as lines/arrows
6. Apply visual encoding: done tasks muted, critical path highlighted, dependency type encoded in edge style

- **Dependencies:** DAG engine, D3.js (`d3-force`, `d3-selection`, `d3-zoom`), `TaskCard` component (for detail overlays)
- **Dependents:** `App.svelte` (view switcher)

### Anti-Patterns

- **Running force simulation on every prop change** — Only restart the simulation when the graph topology changes (tasks added/removed, edges changed), not when task metadata changes (title, done state).
- **Unbounded simulation** — The force simulation must stop (alphaTarget 0) after convergence. Don't let it run indefinitely consuming CPU.
- **Manual DOM for nodes** — Use D3 force for layout calculation only. Render actual DOM nodes via Svelte's `{#each}` with computed positions, or bind D3 to a dedicated SVG/canvas element via `$effect`.
- **No pan/zoom** — Large graphs are unusable without zoom. Use `d3-zoom` for pan and zoom interaction.
- **Svelte 4 syntax** — Do not use `export let` or `$:` reactive declarations.

## Contract

### Definition of Done

- [ ] Renders each task as a node (circle or rect) with its title
- [ ] Renders each dependency as a directed edge (line with arrowhead)
- [ ] Force simulation produces a readable layout that stabilizes
- [ ] Nodes are color-coded by state: done (muted), blocked (red/orange), ready (green/blue)
- [ ] Edges encode dependency type visually (e.g., solid for `fs`, dashed for `ss`)
- [ ] Pan and zoom via mouse/trackpad (d3-zoom)
- [ ] Clicking a node shows task details (title, dependencies, state)
- [ ] Updates reactively when `plan` prop changes; simulation restarts only on topology changes
- [ ] Handles disconnected subgraphs without overlap
- [ ] Uses Svelte 5 runes syntax exclusively
- [ ] Uses scoped Svelte styles (no CSS frameworks)
- [ ] Simulation stops after convergence (alpha decay)
- [ ] Force simulation parameters auto-scale based on node count (v0.2.0)
- [ ] SVG height is responsive to viewport (not fixed at 500px) (v0.2.0)

### Regression Guardrails

- Graph must render without errors for empty task list (show empty state)
- Graph must render for a single node with no edges
- Force simulation must not consume CPU after convergence
- Pan/zoom state must not reset on reactive prop updates
- No memory leaks from D3 selections or simulation timers on component destroy

### Scenarios

**Scenario: Simple DAG visualization**
- Given: A plan with A → B → C
- When: The Graph view renders
- Then: Three nodes appear connected by two directed edges, layout stabilizes within 2 seconds

**Scenario: Disconnected subgraphs**
- Given: A plan with A → B and C → D (no connection between pairs)
- When: The Graph view renders
- Then: Both subgraphs are visible, separated spatially by the force simulation

**Scenario: Node interaction**
- Given: The Graph view is rendered with several tasks
- When: The user clicks on a task node
- Then: Task detail information is displayed (title, state, dependencies)

**Scenario: Pan and zoom**
- Given: A graph with 50+ tasks that exceeds the viewport
- When: The user scrolls to zoom and drags to pan
- Then: The graph zooms and pans smoothly; node positions remain consistent

**Scenario: Reactive update**
- Given: The Graph view is rendered with tasks A → B
- When: A new task C is added with a dependency on A
- Then: The graph adds node C and edge A → C; simulation re-runs to accommodate; existing pan/zoom state is preserved

**Scenario: Empty plan**
- Given: A plan with `tasks: []`
- When: The Graph view renders
- Then: An empty state message is shown (no simulation errors)
