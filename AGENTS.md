# AGENTS.md — Context & Rules for AI Agents

> **Project:** Partial — Agent-native project management via `.plan` files.
> **Core Philosophy:** Projects are DAGs of state, not lists. Local-first,
> Git-based persistence. The `.plan` file is the single source of truth.
> **Key Constraint:** Unknown fields in `.plan` files must always be preserved
> (round-trip safety). Parsers must never discard data they don't understand.

## 1. Personas

### 1.1. Architect / Spec Lead (@Architect)
**Trigger:** When asked about system design, .plan schema evolution, or planning.
* **Goal:** Define specifications, architectural decisions, and feature requirements.
* **Guidelines:**
  - Schema changes to `.plan` format require an ADR in `docs/decisions/`
  - Always produce clear specs before handing off to implementation
  - Break large tasks into bounded PBIs with acceptance criteria
  - Protect round-trip safety: never propose schema changes that break unknown-field preservation

### 1.2. Developer / Implementation Agent (@Dev)
**Trigger:** When assigned implementation tasks, bug fixes, or refactoring.
* **Goal:** Implement features and ensure the codebase remains healthy.
* **Guidelines:**
  - Work from defined PBIs with clear acceptance criteria when available
  - TypeScript strict mode: no `any` types, no non-null assertions without justification
  - All Svelte components use Svelte 5 runes syntax (`$state`, `$derived`, `$effect`)
  - Explicitly import all dependencies; no implicit globals
  - All changes must pass `pnpm check` and `pnpm exec tsc --noEmit`

### 1.3. Parser / Engine Developer (@Engine)
**Trigger:** When working on YAML parsing, DAG logic, or the watcher.
* **Goal:** Maintain the core engine with emphasis on correctness and round-trip safety.
* **Guidelines:**
  - Unknown YAML fields are ALWAYS preserved — this is non-negotiable
  - Use Zod schemas for validation; never cast `as` without validation
  - DAG operations must detect and reject cycles
  - File watcher must handle rename, delete, and rapid-save events gracefully

### 1.4. CLI Developer (@CLI)
**Trigger:** When working on the `partial` command-line tool.
* **Goal:** Build a reliable, composable CLI following Unix conventions.
* **Guidelines:**
  - Output parseable formats (JSON with `--json` flag, plain text default)
  - Exit codes: 0 = success, 1 = user error, 2 = system error
  - All commands must work with stdin/stdout piping

## 2. Tech Stack (Ground Truth)

- **Runtime:** Node.js 20+ (LTS) exclusively
- **Language:** TypeScript 5.x, strict mode enabled
- **Desktop Shell:** Electron (via electron-vite)
- **UI Framework:** Svelte 5 (runes syntax) — do NOT use Svelte 4 patterns
- **Visualization:** D3.js — do NOT use Chart.js, Recharts, or other charting libraries
- **YAML Parsing:** `yaml` package — do NOT use `js-yaml` or other parsers
- **Schema Validation:** Zod — do NOT use Joi, Yup, or io-ts
- **File Watching:** chokidar
- **Graph Logic:** graphlib
- **Linting/Formatting:** Biome — do NOT use ESLint or Prettier
- **Git Hooks:** Lefthook — do NOT use Husky or lint-staged
- **Testing:** Vitest — do NOT use Jest
- **Commits:** Conventional Commits (enforced by Lefthook)

## 3. Operational Boundaries

### Tier 1 — ALWAYS (Constitutive)
- ALWAYS preserve unknown fields when parsing/writing `.plan` files
- ALWAYS add JSDoc comments to exported functions
- ALWAYS use Conventional Commits format
- ALWAYS handle errors explicitly; never swallow with empty catch blocks
- ALWAYS write tests for new parser logic and DAG operations
- ALWAYS respect the deliverables section of a plan — if a plan lists specs and PBIs as deliverables, produce ONLY those artifacts; do NOT write `src/` or `tests/` code unless the deliverables explicitly include implementation

### Tier 2 — ASK (Procedural / Human-in-the-Loop)
- ASK before adding any new dependency
- ASK before modifying the `.plan` schema (version bump required)
- ASK before changing Electron IPC contracts between main/renderer
- ASK before modifying CI/CD workflows
- ASK before restructuring the directory layout
- ASK before moving from spec/PBI creation to code implementation within the same session

### Tier 3 — NEVER (Hard Constraints)
- NEVER commit secrets, API keys, or `.env` files
- NEVER use `any` type in TypeScript (use `unknown` + type guards)
- NEVER modify `src/shared/types.ts` without updating Zod schemas
- NEVER introduce CSS frameworks (Tailwind, etc.) — use scoped Svelte styles
- NEVER add ORM libraries — all data lives in `.plan` files
- NEVER bypass Biome linting rules with inline ignores without justification

## 4. Directory Map

```yaml
directory_map:
  src:
    main:
      index.ts: "Electron main process entry; creates BrowserWindow, sets up IPC, wires file watcher"
      watcher.ts: "Chokidar-based file watcher for *.plan files; emits change/delete/error events"
      parser.ts: "YAML <-> PlanFile conversion; preserves unknown fields on round-trip"
    renderer:
      main.ts: "Svelte app bootstrap; mounts App.svelte"
      App.svelte: "Root component; handles view switching (Gantt/Kanban/Graph) and IPC plan updates"
      views:
        Gantt.svelte: "D3-powered Gantt chart; reads DAG for timeline rendering with critical path"
        Kanban.svelte: "Four-column board; maps task state to Blocked/Ready/In Progress/Done columns"
        Graph.svelte: "D3 force-directed DAG visualization with pan/zoom and click-to-detail"
      components:
        TaskCard.svelte: "Reusable task display unit with status dot, used across all views"
    shared:
      types.ts: "PlanFile, Task, TaskExtended interfaces; the TypeScript schema for .plan format"
      dag.ts: "DAG construction, cycle detection, topological sort, critical path, unblocked tasks"
      ipc.ts: "IPC channel constants and typed payload interfaces for main/renderer communication"
    cli:
      index.ts: "CLI entry point; subcommands: validate, status, unblocked, graph"
    preload:
      index.ts: "Electron preload script; exposes typed PartialAPI via contextBridge"
  tests: "Mirrors src/ structure; Vitest test files"
  plans: "Living specs organized by feature domain (one spec.md per feature)"
  docs:
    decisions: "Architecture Decision Records (ADRs)"
    scaffolding.md: "Full scaffolding guide for project setup"
```

## 5. Command Registry

| Intent | Command | Notes |
|--------|---------|-------|
| **Dev** | `pnpm dev` | Electron + Vite HMR |
| **Build** | `pnpm build` | Outputs to `out/` via electron-vite |
| **Test** | `pnpm test -- --run` | Vitest, single run |
| **Test (watch)** | `pnpm test` | Vitest, watch mode |
| **Coverage** | `pnpm test:coverage` | Vitest + v8 coverage |
| **Lint** | `pnpm check` | Biome check (lint + format) |
| **Lint (fix)** | `pnpm check:fix` | Biome auto-fix |
| **Type Check** | `pnpm exec tsc --noEmit` | TypeScript compilation check |
| **Svelte Check** | `pnpm exec svelte-check` | Svelte-specific diagnostics |
| **Git Hooks** | `pnpm exec lefthook install` | Initialize git hooks |

## 6. Coding Standards

<coding_standard name="Svelte Components">
  <instruction>
    Use Svelte 5 runes syntax. Functional, composable components.
    Props via $props(), reactive state via $state(), derived via $derived().
  </instruction>
  <anti_pattern>
    export let prop; // Svelte 4 syntax
    $: derived = ... // Svelte 4 reactive declarations
  </anti_pattern>
  <preferred_pattern>
    let { prop } = $props();
    let derived = $derived(expression);
  </preferred_pattern>
</coding_standard>

<coding_standard name="Error Handling">
  <instruction>
    All errors must be explicitly handled. Use Result types or
    try/catch with typed error handling. Never swallow errors.
  </instruction>
  <anti_pattern>
    try { ... } catch (e) { }
    try { ... } catch (e) { console.log(e) }
  </anti_pattern>
  <preferred_pattern>
    try { ... } catch (e: unknown) {
      if (e instanceof ParseError) { handleParseError(e) }
      else { throw e }
    }
  </preferred_pattern>
</coding_standard>

<coding_standard name="Plan File Parsing">
  <instruction>
    Unknown fields MUST survive round-trips. Use spread operators
    and index signatures. Never destructure-and-reconstruct plan data.
  </instruction>
  <anti_pattern>
    const { version, project, tasks } = planData;
    return { version, project, tasks }; // Drops unknown fields!
  </anti_pattern>
  <preferred_pattern>
    return { ...planData, tasks: processedTasks }; // Preserves all fields
  </preferred_pattern>
</coding_standard>

## 7. Context References

- **Plan Schema:** See `src/shared/types.ts` for canonical TypeScript types
- **Feature Specs:** See `plans/{feature}/spec.md`
- **Scaffolding:** See `docs/scaffolding.md`
- **ADRs:** See `docs/decisions/`
- **Backlog:** See `plans/backlog.md` for PBI tracking
- **Demo Plan:** See `demo/partial.plan` for the project's own .plan file
