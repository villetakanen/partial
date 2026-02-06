# Project Partial — Product Backlog

> **Format:** ASDLC PBI pattern (Directive + Context Pointer + Verification + Refinement)
> **Ordering:** Dependency-resolved; items higher in the list can be started first.
> **Atomicity:** Each PBI produces a single committable, testable increment.

---

## Dependency Graph

```
PBI-001 (package.json + deps)
PBI-002 (tsconfig)              ← PBI-001
PBI-003 (biome)                 ← PBI-001
PBI-004 (lefthook)              ← PBI-001, PBI-003
PBI-005 (directory structure)   ← PBI-002
PBI-006 (shared types)          ← PBI-005
PBI-007 (Zod schemas)           ← PBI-006
PBI-008 (parser: parsePlan)     ← PBI-007
PBI-009 (parser: stringifyPlan) ← PBI-008
PBI-010 (parser: round-trip)    ← PBI-009
PBI-011 (DAG: buildDAG)         ← PBI-007
PBI-012 (DAG: cycle detection)  ← PBI-011
PBI-013 (DAG: topo sort)        ← PBI-011
PBI-014 (DAG: unblocked)        ← PBI-011
PBI-015 (DAG: critical path)    ← PBI-013
PBI-016 (file watcher: core)    ← PBI-008
PBI-017 (file watcher: debnce)  ← PBI-016
PBI-018 (file watcher: errors)  ← PBI-016
PBI-019 (electron: main entry)  ← PBI-005, PBI-039
PBI-020 (electron: preload+IPC) ← PBI-019
PBI-021 (electron: watcher IPC) ← PBI-016, PBI-020
PBI-022 (renderer: bootstrap)   ← PBI-020
PBI-023 (App.svelte: views)     ← PBI-022
PBI-024 (TaskCard component)    ← PBI-022, PBI-006
PBI-025 (Kanban view)           ← PBI-023, PBI-024, PBI-014
PBI-026 (Gantt view)            ← PBI-023, PBI-024, PBI-015
PBI-027 (Graph view)            ← PBI-023, PBI-024, PBI-011
PBI-028 (CLI: scaffold + validate) ← PBI-008
PBI-029 (CLI: status)           ← PBI-028, PBI-014
PBI-030 (CLI: unblocked)        ← PBI-028, PBI-014
PBI-031 (CLI: graph)            ← PBI-028, PBI-011
PBI-032 (electron-builder)      ← PBI-019
PBI-033 (CI workflow)           ← PBI-003, PBI-002
PBI-034 (release workflow)      ← PBI-032, PBI-033
PBI-035 (AGENTS.md + CLAUDE.md) ← PBI-005
PBI-036 (PR + issue templates)  ← PBI-001
PBI-037 (.gitignore)            ← None
PBI-038 (README.md)             ← PBI-001
PBI-039 (electron-vite config)  ← PBI-001, PBI-002
PBI-040 (vitest config)         ← PBI-001, PBI-002
PBI-041 (test fixtures)         ← PBI-005
PBI-042 (Vitest workspace)      ← PBI-040
PBI-043 (demo .plan file)       ← PBI-005
```

---

## Layer 0 — Project Foundation

### PBI-001: Initialize package.json and install dependencies

#### Directive
Create `package.json` with project metadata, scripts, and install all production and dev dependencies as specified in the scaffolding guide.

**Scope:**
- `package.json`
- `pnpm-lock.yaml` (generated)
- Do NOT create any `src/` files

#### Dependencies
- Blocked by: None
- Must merge before: PBI-002, PBI-003, PBI-004, PBI-005

#### Context
Read: `docs/scaffolding.md` — Section 3 (Project Initialization)

#### Verification
- [x] `package.json` contains all scripts: dev, build, preview, check, check:fix, test, test:coverage, prepare
- [x] `package.json` has `"type": "module"` and `"engines": { "node": ">=20.0.0" }`
- [x] `pnpm install` completes without errors
- [x] All dependencies from scaffolding Section 3 Step 2 are present (electron, svelte, d3, yaml, chokidar, graphlib, zod, biome, lefthook, vitest, etc.)
- [x] `pnpm check` does not crash (biome is callable)

#### Refinement Protocol
If a dependency version conflict arises, resolve it and document the resolution in the commit message body.

---

### PBI-002: Add TypeScript configuration

#### Directive
Create `tsconfig.json` with strict mode, ES2022 target, bundler module resolution, and path aliases for `@shared/*`, `@main/*`, `@renderer/*`.

**Scope:**
- `tsconfig.json`
- Do NOT create `src/` directories yet

#### Dependencies
- Blocked by: PBI-001
- Must merge before: PBI-005, PBI-033

#### Context
Read: `docs/scaffolding.md` — Section 4 (TypeScript Configuration)

#### Verification
- [x] `pnpm exec tsc --version` runs successfully
- [x] `tsconfig.json` has `"strict": true`
- [x] `tsconfig.json` has path aliases: `@shared/*`, `@main/*`, `@renderer/*`
- [x] `tsconfig.json` targets `ES2022` with `ESNext` module

#### Refinement Protocol
If electron-vite requires additional tsconfig overrides (e.g., separate configs per process), add them and note in commit body.

---

### PBI-003: Add Biome configuration

#### Directive
Create `biome.json` with project formatting and linting rules: tab indentation, single quotes, no semicolons, recommended rules with custom overrides.

**Scope:**
- `biome.json`

#### Dependencies
- Blocked by: PBI-001
- Must merge before: PBI-004, PBI-033

#### Context
Read: `docs/scaffolding.md` — Section 5 (Biome Configuration)

#### Verification
- [x] `pnpm exec biome check .` runs without crashing
- [x] `biome.json` uses tab indentation, single quotes, no semicolons
- [x] `biome.json` ignores `dist/`, `node_modules/`, `*.plan`
- [x] Linter rules include `noExplicitAny: warn`, `useConst: error`, `noNonNullAssertion: warn`

#### Refinement Protocol
If Biome version requires schema updates, use the latest stable schema URL.

---

### PBI-004: Add Lefthook git hooks and Conventional Commits enforcement

#### Directive
Create `lefthook.yml` with pre-commit (biome check + format), commit-msg (Conventional Commits regex), and pre-push (test + typecheck + svelte-check) hooks. Run `pnpm exec lefthook install`.

**Scope:**
- `lefthook.yml`
- `.git/hooks/` (generated by lefthook install)

#### Dependencies
- Blocked by: PBI-001, PBI-003
- Must merge before: None (quality gate, not a code dependency)

#### Context
Read: `docs/scaffolding.md` — Section 7 (Lefthook Configuration) and Section 8 (Conventional Commits)

#### Verification
- [x] `pnpm exec lefthook install` completes successfully
- [x] A commit with message `bad message` is rejected by commit-msg hook
- [x] A commit with message `feat(parser): add something` is accepted
- [x] Pre-commit hook runs biome check on staged files

#### Refinement Protocol
If lefthook version changes hook API, update `lefthook.yml` syntax accordingly.

---

### PBI-005: Create initial directory structure

#### Directive
Create the empty directory scaffold: `src/main/`, `src/renderer/views/`, `src/renderer/components/`, `src/shared/`, `src/cli/`, `tests/`, `docs/decisions/`, `plans/`. Add `.gitkeep` files to keep empty directories in git.

**Scope:**
- All directories listed in scaffolding Section 2
- `.gitkeep` files only
- Do NOT create any source files

#### Dependencies
- Blocked by: PBI-002
- Must merge before: PBI-006, PBI-019, PBI-035

#### Context
Read: `docs/scaffolding.md` — Section 2 (Repository Structure)

#### Verification
- [x] All directories exist: `src/main`, `src/renderer/views`, `src/renderer/components`, `src/shared`, `src/cli`, `tests`, `docs/decisions`
- [x] `plans/` directory exists with feature subdirectories
- [x] `.gitkeep` files present in otherwise-empty directories
- [x] `git status` shows all directories tracked

#### Refinement Protocol
None — this is a structural task with no ambiguity.

---

### PBI-036: Add GitHub PR and issue templates

#### Directive
Create `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, and `.github/ISSUE_TEMPLATE/feature_request.md`.

**Scope:**
- `.github/` directory and its contents
- Do NOT create workflow files (those are separate PBIs)

#### Dependencies
- Blocked by: PBI-001
- Must merge before: None

#### Context
Read: `docs/scaffolding.md` — Section 9 (Pull Request Template)

#### Verification
- [x] `.github/pull_request_template.md` exists with summary, type-of-change checklist, testing section, and commit checklist
- [x] `.github/ISSUE_TEMPLATE/bug_report.md` exists
- [x] `.github/ISSUE_TEMPLATE/feature_request.md` exists

#### Refinement Protocol
None.

---

## Layer 1 — Shared Types & Schemas

### PBI-006: Create shared TypeScript type definitions

#### Directive
Implement `src/shared/types.ts` with `PlanFile`, `Task`, `TaskExtended`, and `DependencyType` interfaces. All interfaces must include index signatures for unknown field preservation.

**Scope:**
- `src/shared/types.ts`

#### Dependencies
- Blocked by: PBI-005
- Must merge before: PBI-007, PBI-024

#### Context
Read: `plans/plan-parser/spec.md` — Blueprint → Architecture → Data Models
Read: `docs/scaffolding.md` — Section 10 (Initial Files, types.ts)

#### Verification
- [x] `PlanFile` interface has `version`, `project`, `tasks`, and `[key: string]: unknown`
- [x] `Task` interface has `id`, `title`, `done?`, `needs?`, `parent?`, and `[key: string]: unknown`
- [x] `TaskExtended` extends `Task` with `type?`, `state?`, `needs_fs?`, `needs_ss?`, `needs_ff?`, `needs_sf?`
- [x] `DependencyType` is `'fs' | 'ss' | 'ff' | 'sf'`
- [x] `pnpm exec tsc --noEmit` passes
- [x] All exported types have JSDoc comments

#### Refinement Protocol
If additional types are needed by downstream PBIs, add them here and update the commit message.

---

### PBI-007: Add Zod validation schemas for .plan files

#### Directive
Create Zod schemas that mirror the TypeScript interfaces in `types.ts`. The schemas must use `.passthrough()` to preserve unknown fields. Export a `validatePlan` function that returns typed validation results.

**Scope:**
- `src/shared/schemas.ts` (new file)
- `tests/shared/schemas.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-006
- Must merge before: PBI-008, PBI-011

#### Context
Read: `plans/plan-parser/spec.md` — Blueprint → Architecture (Zod validation)
Read: `plans/plan-parser/spec.md` — Contract → Scenarios (Invalid YAML, Default values)

#### Verification
- [x] `TaskSchema` validates required fields (`id`, `title`) and allows unknown fields via `.passthrough()`
- [x] `PlanFileSchema` validates required fields (`version`, `project`, `tasks`) with `.passthrough()`
- [x] `validatePlan(data)` returns `{ success: true, data: PlanFile }` or `{ success: false, errors: ZodError }`
- [x] Validation rejects a plan missing `project` field with an actionable error message
- [x] Validation accepts a plan with extra unknown fields (round-trip safe)
- [x] Tests pass: `pnpm test -- --run tests/shared/schemas.test.ts`
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If Zod's `.passthrough()` doesn't preserve nested unknown fields, document the limitation and propose a workaround.

---

## Layer 2 — Parser

### PBI-008: Implement parsePlan function

#### Directive
Implement `parsePlan(content: string): PlanFile` in `src/main/parser.ts`. Parse YAML using the `yaml` package, validate through Zod schemas, apply defaults (`version`, `tasks`, `done`). Throw typed errors with line/column info on invalid input.

**Scope:**
- `src/main/parser.ts`
- `tests/main/parser.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-007
- Must merge before: PBI-009, PBI-016, PBI-028

#### Context
Read: `plans/plan-parser/spec.md` — Full spec
Read: `docs/scaffolding.md` — Section 10 (parser.ts)

#### Verification
- [x] `parsePlan` accepts valid YAML and returns a typed `PlanFile`
- [x] Default values applied: `version` → `"1.0.0"`, `tasks` → `[]`, `task.done` → `false`
- [x] Invalid YAML throws a typed error with line/column when available
- [x] Empty string input returns a valid empty `PlanFile`
- [x] Unknown fields at root and task level are preserved in the output
- [x] Tests pass: `pnpm test -- --run tests/main/parser.test.ts`
- [x] Test coverage for `parsePlan` >= 90%

#### Refinement Protocol
If the `yaml` package error format differs from expected, adapt error mapping and update spec scenarios.

---

### PBI-009: Implement stringifyPlan function

#### Directive
Implement `stringifyPlan(plan: PlanFile): string` in `src/main/parser.ts`. Serialize a `PlanFile` back to YAML using the `yaml` package with consistent indentation and no line wrapping. Must not mutate the input.

**Scope:**
- `src/main/parser.ts` (append to existing)
- `tests/main/parser.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-008
- Must merge before: PBI-010

#### Context
Read: `plans/plan-parser/spec.md` — Blueprint → Architecture → `stringifyPlan`

#### Verification
- [x] `stringifyPlan` produces valid YAML output
- [x] Indentation is 2 spaces, no line wrapping
- [x] Input `PlanFile` object is not mutated
- [x] Field order is stable across calls with identical input
- [x] Tests pass: `pnpm test -- --run tests/main/parser.test.ts`

#### Refinement Protocol
If `yaml` stringify options change, update the call and document in commit body.

---

### PBI-010: Add round-trip safety tests for parser

#### Directive
Write comprehensive round-trip tests: parse a `.plan` string, stringify it back, parse again, and assert deep equality. Cover unknown fields at root, task, and nested levels. This is the parser's core contract validation.

**Scope:**
- `tests/main/parser.roundtrip.test.ts` (new file)
- `tests/fixtures/` (new directory with sample `.plan` files)

#### Dependencies
- Blocked by: PBI-009
- Must merge before: None (quality gate)

#### Context
Read: `plans/plan-parser/spec.md` — Contract → Scenarios (Basic round-trip, Unknown fields preserved)

#### Verification
- [ ] Round-trip test with standard `.plan` file passes (parse → stringify → parse → deep equal)
- [ ] Round-trip preserves unknown root-level fields (`custom_metadata: { author: "alice" }`)
- [ ] Round-trip preserves unknown task-level fields (`priority: high`)
- [ ] Round-trip preserves nested unknown fields
- [ ] Round-trip handles all four dependency types (`needs_fs`, `needs_ss`, `needs_ff`, `needs_sf`)
- [ ] At least 3 fixture `.plan` files covering different complexities
- [ ] All tests pass: `pnpm test -- --run tests/main/parser.roundtrip.test.ts`

#### Refinement Protocol
If round-trip reveals YAML library quirks (comment stripping, key reordering), document as known limitations in spec.

---

## Layer 2 — DAG Engine (parallel with Parser Layer 2)

### PBI-011: Implement buildDAG function

#### Directive
Implement `buildDAG(tasks: Task[]): Graph` in `src/shared/dag.ts` using the `graphlib` library. Create a node per task, an edge per dependency (from `needs` and `needs_*` fields). Throw on references to non-existent task IDs.

**Scope:**
- `src/shared/dag.ts`
- `tests/shared/dag.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-007
- Must merge before: PBI-012, PBI-013, PBI-014, PBI-027, PBI-031

#### Context
Read: `plans/dag-engine/spec.md` — Full spec

#### Verification
- [x] `buildDAG` creates a node for each task
- [x] `buildDAG` creates directed edges from `needs` arrays
- [x] All four dependency types (`needs_fs`, `needs_ss`, `needs_ff`, `needs_sf`) produce typed edges
- [x] Missing dependency reference throws an error identifying the broken reference
- [x] Disconnected subgraphs are correctly represented
- [x] Tests pass: `pnpm test -- --run tests/shared/dag.test.ts`
- [x] All exported functions have JSDoc comments

#### Refinement Protocol
If `graphlib` API has changed, adapt usage and note in commit. If a different graph library is needed, flag for human review before switching.

---

### PBI-012: Implement cycle detection

#### Directive
Implement `detectCycles(graph: Graph): string[] | null` in `src/shared/dag.ts`. Return the cycle path if one exists, `null` otherwise. Must never produce false negatives.

**Scope:**
- `src/shared/dag.ts` (append)
- `tests/shared/dag.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-011
- Must merge before: None (consumed by views and CLI as needed)

#### Context
Read: `plans/dag-engine/spec.md` — Contract → Scenarios (Cycle detected)

#### Verification
- [x] Returns `null` for acyclic graphs
- [x] Returns the cycle path array for cyclic graphs (e.g., `["A", "B", "C", "A"]`)
- [x] Detects self-referencing tasks (A → A)
- [x] Detects indirect cycles (A → B → C → A)
- [x] Tests pass with at least 4 cycle/no-cycle scenarios

#### Refinement Protocol
None — cycle detection algorithm is well-defined.

---

### PBI-013: Implement topological sort

#### Directive
Implement `topologicalSort(graph: Graph): Task[]` in `src/shared/dag.ts`. Return tasks in dependency order. Output must be deterministic for identical inputs.

**Scope:**
- `src/shared/dag.ts` (append)
- `tests/shared/dag.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-011
- Must merge before: PBI-015

#### Context
Read: `plans/dag-engine/spec.md` — Contract → Scenarios (Linear chain, Diamond dependency)

#### Verification
- [x] Linear chain A → B → C returns `[A, B, C]`
- [x] Diamond dependency produces valid topological order (A first, D last)
- [x] Deterministic: same input produces same output across runs
- [x] Handles disconnected subgraphs (all tasks included in output)
- [x] Tests pass

#### Refinement Protocol
None.

---

### PBI-014: Implement getUnblockedTasks

#### Directive
Implement `getUnblockedTasks(graph: Graph, tasks: Task[]): Task[]` in `src/shared/dag.ts`. Return tasks whose dependencies are all `done: true`, plus tasks with no dependencies that are not yet done.

**Scope:**
- `src/shared/dag.ts` (append)
- `tests/shared/dag.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-011
- Must merge before: PBI-025, PBI-029, PBI-030

#### Context
Read: `plans/dag-engine/spec.md` — Contract → Scenarios (Unblocked tasks)

#### Verification
- [x] Tasks with all dependencies `done: true` are returned
- [x] Tasks with no dependencies and `done: false` are returned
- [x] Tasks with unfinished dependencies are excluded
- [x] Already-done tasks are excluded (they're done, not "unblocked")
- [x] Tests pass with the exact scenario from the spec

#### Refinement Protocol
None.

---

### PBI-015: Implement critical path calculation

#### Directive
Implement `criticalPath(graph: Graph): Task[]` in `src/shared/dag.ts`. Compute the longest dependency chain in the DAG.

**Scope:**
- `src/shared/dag.ts` (append)
- `tests/shared/dag.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-013
- Must merge before: PBI-026

#### Context
Read: `plans/dag-engine/spec.md` — Contract → Definition of Done (criticalPath)

#### Verification
- [x] Returns the longest chain for a DAG with multiple paths
- [x] Handles single-task graphs (critical path is just that task)
- [x] Handles disconnected subgraphs (returns the longest chain across all)
- [x] Tests pass with at least 3 scenarios (linear, diamond, multi-path)

#### Refinement Protocol
If duration/weight metadata is needed for accurate scheduling, flag for spec update and implement with unit weights initially.

---

## Layer 3 — File Watcher

### PBI-016: Implement core file watcher

#### Directive
Implement `watchDirectory(dirPath: string): PlanWatcher` in `src/main/watcher.ts` using chokidar. Watch for `*.plan` file create, modify, and delete events. Parse changed files through `parsePlan`. Emit typed events.

**Scope:**
- `src/main/watcher.ts`
- `tests/main/watcher.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-008
- Must merge before: PBI-017, PBI-018, PBI-021

#### Context
Read: `plans/file-watcher/spec.md` — Full spec

#### Verification
- [x] Watches a directory for `*.plan` files only
- [x] Emits `change` event with parsed `PlanFile` on file create/modify
- [x] Emits `delete` event with file path on deletion
- [x] Ignores non-`.plan` files and hidden files
- [x] `close()` method cleans up all watchers
- [x] Tests pass (use temp directories for isolation)
- [x] All exported functions have JSDoc comments

#### Refinement Protocol
If chokidar v4 API differs from v3, adapt and document.

---

### PBI-017: Add debouncing to file watcher

#### Directive
Add configurable debouncing (default 100ms) to the file watcher to coalesce rapid successive file system events into a single `change` emission.

**Scope:**
- `src/main/watcher.ts` (modify)
- `tests/main/watcher.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-016
- Must merge before: None

#### Context
Read: `plans/file-watcher/spec.md` — Contract → Scenarios (Rapid saves debounced)

#### Verification
- [x] 5 rapid writes within 50ms produce exactly 1 `change` event
- [x] Debounce interval is configurable via `watchDirectory` options
- [x] Default debounce is 100ms
- [x] Event contains the final file state, not an intermediate one
- [x] Tests pass

#### Refinement Protocol
None.

---

### PBI-018: Add error handling to file watcher

#### Directive
Emit `error` events when a watched `.plan` file contains invalid YAML. Include file path and parse error details. Ensure the watcher continues running after errors (no crash).

**Scope:**
- `src/main/watcher.ts` (modify)
- `tests/main/watcher.test.ts` (append tests)

#### Dependencies
- Blocked by: PBI-016
- Must merge before: None

#### Context
Read: `plans/file-watcher/spec.md` — Contract → Scenarios (Invalid YAML saved)

#### Verification
- [x] Invalid YAML in a watched file emits an `error` event (not a thrown exception)
- [x] Error event includes `filePath` and structured parse error
- [x] Watcher continues watching after an error (does not crash or stop)
- [x] Subsequent valid save emits a normal `change` event
- [x] Tests pass

#### Refinement Protocol
None.

---

## Layer 3 — Electron Shell (parallel with File Watcher)

### PBI-019: Create Electron main process entry point

#### Directive
Implement `src/main/index.ts` as the Electron main process entry. Create a `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`. Load the renderer's `index.html`. Handle app lifecycle events (ready, window-all-closed, activate).

**Scope:**
- `src/main/index.ts`
- `src/renderer/index.html` (minimal HTML shell)

#### Dependencies
- Blocked by: PBI-005
- Must merge before: PBI-020, PBI-032

#### Context
Read: `plans/electron-shell/spec.md` — Blueprint → Architecture (Main Process Responsibilities)

#### Verification
- [ ] `pnpm dev` starts Electron and shows a window
- [ ] `BrowserWindow` has `contextIsolation: true`, `nodeIntegration: false`
- [ ] macOS: app stays running when all windows close; dock click recreates window
- [ ] Windows/Linux: app quits when all windows close
- [ ] No console errors on startup

#### Refinement Protocol
If electron-vite requires specific main process configuration, adapt and document.

---

### PBI-020: Add preload script and IPC channel registration

#### Directive
Create `src/main/preload.ts` exposing a typed API to the renderer via `contextBridge`. Register IPC handlers in main process for all documented channels: `plan:updated`, `plan:deleted`, `plan:error`, `plan:open-directory`, `plan:save`.

**Scope:**
- `src/main/preload.ts` (new file)
- `src/main/index.ts` (add IPC handler registrations)
- `src/shared/ipc.ts` (new file — shared channel name constants and payload types)

#### Dependencies
- Blocked by: PBI-019
- Must merge before: PBI-021, PBI-022

#### Context
Read: `plans/electron-shell/spec.md` — Blueprint → Architecture (IPC Channel Contract)

#### Verification
- [ ] `preload.ts` uses `contextBridge.exposeInMainWorld` with a typed API object
- [ ] All 5 IPC channels are registered as constants in `src/shared/ipc.ts`
- [ ] Payload types for each channel are defined and exported
- [ ] Main process `ipcMain.handle` is used (async), not `ipcMain.on` for request/response
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] Renderer cannot access `require`, `fs`, or `process` (contextIsolation enforced)

#### Refinement Protocol
If additional IPC channels are discovered as needed, add them to `ipc.ts` and update the electron-shell spec.

---

### PBI-021: Wire file watcher to Electron IPC

#### Directive
Connect the file watcher's events to the IPC channels so that `change`, `delete`, and `error` events from the watcher are forwarded to the renderer via the registered IPC channels.

**Scope:**
- `src/main/index.ts` (modify — integrate watcher with IPC sends)

#### Dependencies
- Blocked by: PBI-016, PBI-020
- Must merge before: None (views will receive data once connected)

#### Context
Read: `plans/electron-shell/spec.md` — Contract → Scenarios (Live file update, Parse error forwarded)
Read: `plans/file-watcher/spec.md` — Blueprint → Architecture (IPC Contract)

#### Verification
- [ ] Watcher `change` event triggers `plan:updated` IPC to renderer
- [ ] Watcher `delete` event triggers `plan:deleted` IPC to renderer
- [ ] Watcher `error` event triggers `plan:error` IPC to renderer
- [ ] `plan:open-directory` from renderer starts watcher on specified directory
- [ ] Watcher ignores its own writes when `plan:save` writes a file
- [ ] No double-parsing when Partial writes and then watches its own file

#### Refinement Protocol
If write-lock mechanism for self-write detection needs design, propose approach in commit message.

---

## Layer 4 — Renderer & Components

### PBI-022: Bootstrap Svelte renderer

#### Directive
Create the Svelte 5 application bootstrap: `src/renderer/main.ts` mounts `App.svelte` into the HTML shell. Configure Vite plugin for Svelte. Verify HMR works in dev mode.

**Scope:**
- `src/renderer/main.ts`
- `src/renderer/App.svelte` (minimal placeholder)
- `electron.vite.config.ts` or `vite.config.ts` (renderer Vite config)

#### Dependencies
- Blocked by: PBI-020
- Must merge before: PBI-023

#### Context
Read: `plans/electron-shell/spec.md` — Blueprint → Architecture (Renderer Architecture)

#### Verification
- [ ] `pnpm dev` shows the Svelte app in the Electron window
- [ ] `App.svelte` renders a placeholder UI
- [ ] Svelte 5 runes syntax works (`$state`, `$derived`)
- [ ] HMR updates the renderer without full reload
- [ ] `pnpm exec svelte-check` passes
- [ ] No `export let` or `$:` syntax (Svelte 4 patterns)

#### Refinement Protocol
If electron-vite requires specific Svelte plugin configuration, adapt.

---

### PBI-023: Implement App.svelte view switching

#### Directive
Implement view switching in `App.svelte` between Gantt, Kanban, and Graph views. Use `$state` for the active view. Create placeholder components for each view. Receive plan data from IPC and compute DAG for views.

**Scope:**
- `src/renderer/App.svelte` (modify)
- `src/renderer/views/Gantt.svelte` (placeholder)
- `src/renderer/views/Kanban.svelte` (placeholder)
- `src/renderer/views/Graph.svelte` (placeholder)

#### Dependencies
- Blocked by: PBI-022
- Must merge before: PBI-025, PBI-026, PBI-027

#### Context
Read: `plans/electron-shell/spec.md` — Contract → Scenarios (View switching)

#### Verification
- [ ] Tab/nav UI allows switching between three views
- [ ] Active view state uses `$state()` rune
- [ ] Each view receives `plan` and `dag` as props
- [ ] Plan data received from IPC is stored in `$state`
- [ ] DAG computed via `$derived` from plan data
- [ ] Switching views does not lose plan state
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
None.

---

### PBI-024: Implement TaskCard component

#### Directive
Create a reusable `TaskCard.svelte` component that displays a single task's information: title, state (done/blocked/ready), dependency count. Used across all three views.

**Scope:**
- `src/renderer/components/TaskCard.svelte`

#### Dependencies
- Blocked by: PBI-022, PBI-006
- Must merge before: PBI-025, PBI-026, PBI-027

#### Context
Read: `plans/kanban-view/spec.md` — Blueprint (TaskCard usage)
Read: `plans/gantt-view/spec.md` — Blueprint (TaskCard usage)

#### Verification
- [ ] Accepts `task: Task` and `status: 'done' | 'blocked' | 'ready' | 'in_progress'` via `$props()`
- [ ] Renders task title
- [ ] Visual distinction between done, blocked, ready, and in-progress states
- [ ] Uses scoped Svelte styles (no CSS frameworks)
- [ ] Uses Svelte 5 runes syntax exclusively
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
None.

---

## Layer 5 — Views

### PBI-025: Implement Kanban view

#### Directive
Implement `Kanban.svelte` with four columns (Blocked, Ready, In Progress, Done). Use `getUnblockedTasks` from the DAG engine to derive column assignment. Render `TaskCard` components. Update reactively.

**Scope:**
- `src/renderer/views/Kanban.svelte`

#### Dependencies
- Blocked by: PBI-023, PBI-024, PBI-014
- Must merge before: None

#### Context
Read: `plans/kanban-view/spec.md` — Full spec

#### Verification
- [ ] Four columns rendered: Blocked, Ready, In Progress, Done
- [ ] Column assignment derived from DAG engine (not manual logic)
- [ ] Each task appears in exactly one column
- [ ] Empty columns show placeholder text
- [ ] Task counts shown per column
- [ ] Handles `state: "in_progress"` extended field
- [ ] Updates reactively when plan prop changes
- [ ] Empty plan renders without errors
- [ ] Uses Svelte 5 runes, scoped styles, no CSS frameworks
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If column definitions need to be configurable, flag for spec update.

---

### PBI-026: Implement Gantt view

#### Directive
Implement `Gantt.svelte` with D3-powered horizontal bar chart. Derive task positions from topological order and critical path. Render dependency connectors. Support horizontal and vertical scrolling.

**Scope:**
- `src/renderer/views/Gantt.svelte`

#### Dependencies
- Blocked by: PBI-023, PBI-024, PBI-015
- Must merge before: None

#### Context
Read: `plans/gantt-view/spec.md` — Full spec

#### Verification
- [ ] Tasks rendered as horizontal bars in dependency order
- [ ] Dependency edges drawn as connector lines
- [ ] Critical path visually highlighted
- [ ] Done tasks visually muted
- [ ] Horizontal and vertical scrolling for large projects
- [ ] Responsive to container resizing
- [ ] Empty plan renders empty state (no errors)
- [ ] Uses D3 for layout calculation, Svelte for DOM
- [ ] Uses Svelte 5 runes, scoped styles
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If D3 integration pattern with Svelte 5 requires specific approach, document the chosen pattern.

---

### PBI-027: Implement Graph view

#### Directive
Implement `Graph.svelte` with D3 force-directed layout. Render task nodes and dependency edges. Support pan/zoom via `d3-zoom`. Clicking a node shows detail. Simulation stops after convergence.

**Scope:**
- `src/renderer/views/Graph.svelte`

#### Dependencies
- Blocked by: PBI-023, PBI-024, PBI-011
- Must merge before: None

#### Context
Read: `plans/graph-view/spec.md` — Full spec

#### Verification
- [ ] Tasks rendered as nodes, dependencies as directed edges
- [ ] Force simulation stabilizes (alpha decays to 0)
- [ ] Pan and zoom via mouse/trackpad
- [ ] Click on node shows task details
- [ ] Nodes color-coded by state (done/blocked/ready)
- [ ] Edge style encodes dependency type
- [ ] Empty plan renders empty state
- [ ] Simulation restarts only on topology changes, not metadata changes
- [ ] No CPU consumption after convergence
- [ ] Uses Svelte 5 runes, scoped styles
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If force simulation parameters need tuning, document chosen values.

---

## Layer 3 — CLI (parallel with Electron layers)

### PBI-028: Scaffold CLI entry point and implement validate command

#### Directive
Create `src/cli/index.ts` as the CLI entry point. Implement `partial validate [file]` that parses a `.plan` file through the parser and reports success or schema errors. Support `--json` flag, stdin piping, and correct exit codes.

**Scope:**
- `src/cli/index.ts`
- `tests/cli/validate.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-008
- Must merge before: PBI-029, PBI-030, PBI-031

#### Context
Read: `plans/cli/spec.md` — Full spec (focus on validate command)

#### Verification
- [x] `partial validate project.plan` prints "Valid" and exits `0` for valid files
- [x] Invalid files print errors and exit `1`
- [x] Missing files print error to stderr and exit `2`
- [x] `--json` outputs structured JSON
- [x] `--help` prints usage
- [x] `--version` prints version from package.json
- [x] Piped input works: `cat file.plan | partial validate`
- [x] No Electron imports
- [x] Tests pass

#### Refinement Protocol
If a CLI argument parsing library is needed, propose it and document the choice.

---

### PBI-029: Implement CLI status command

#### Directive
Implement `partial status [file]` that displays task counts by state: done, ready, blocked. Uses the DAG engine's `getUnblockedTasks` to determine ready vs. blocked.

**Scope:**
- `src/cli/index.ts` (append command)
- `tests/cli/status.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-028, PBI-014
- Must merge before: None

#### Context
Read: `plans/cli/spec.md` — Contract → Scenarios (Status summary, JSON output)

#### Verification
- [x] Prints counts: done, ready, blocked
- [x] `--json` outputs `{ "done": N, "ready": N, "blocked": N }`
- [x] Exit code `0` on success
- [x] Piped input supported
- [x] Tests pass

#### Refinement Protocol
None.

---

### PBI-030: Implement CLI unblocked command

#### Directive
Implement `partial unblocked [file]` that lists task IDs whose dependencies are all satisfied. Uses `getUnblockedTasks`.

**Scope:**
- `src/cli/index.ts` (append command)
- `tests/cli/unblocked.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-028, PBI-014
- Must merge before: None

#### Context
Read: `plans/cli/spec.md` — Contract → Scenarios (Unblocked tasks)

#### Verification
- [x] Prints unblocked task IDs, one per line
- [x] `--json` outputs array of task objects
- [x] Exit code `0` on success
- [x] Piped input supported
- [x] Tests pass

#### Refinement Protocol
None.

---

### PBI-031: Implement CLI graph command

#### Directive
Implement `partial graph [file]` that outputs the dependency graph as human-readable text (and optionally DOT format for Graphviz).

**Scope:**
- `src/cli/index.ts` (append command)
- `tests/cli/graph.test.ts` (new file)

#### Dependencies
- Blocked by: PBI-028, PBI-011
- Must merge before: None

#### Context
Read: `plans/cli/spec.md` — Contract → Scenarios (Graph output)

#### Verification
- [ ] Prints text representation of dependency edges (e.g., `A → B`)
- [ ] `--json` outputs graph as JSON adjacency structure
- [ ] Exit code `0` on success
- [ ] Piped input supported
- [ ] Tests pass

#### Refinement Protocol
If DOT format is deferred, note it as a future enhancement.

---

## Layer 6 — Build & CI

### PBI-032: Add electron-builder configuration

#### Directive
Create `electron-builder.json` with platform-specific build targets (dmg/zip for macOS, nsis/portable for Windows, AppImage/deb/rpm for Linux). Add build scripts to `package.json`.

**Scope:**
- `electron-builder.json`
- `package.json` (add build:mac, build:win, build:linux, release scripts)

#### Dependencies
- Blocked by: PBI-019
- Must merge before: PBI-034

#### Context
Read: `docs/scaffolding.md` — Section 6 (Electron Builder Configuration)

#### Verification
- [ ] `electron-builder.json` matches scaffolding spec
- [ ] `pnpm build` completes without errors (produces `dist/`)
- [ ] Build scripts added: `build:mac`, `build:win`, `build:linux`, `release`
- [ ] `appId` is `com.partial.app`, `productName` is `Partial`

#### Refinement Protocol
If electron-builder version requires schema changes, update accordingly.

---

### PBI-033: Add GitHub Actions CI workflow

#### Directive
Create `.github/workflows/ci.yml` that runs on push to main and PRs: install, biome check, TypeScript check, test with coverage, and cross-platform build matrix.

**Scope:**
- `.github/workflows/ci.yml`

#### Dependencies
- Blocked by: PBI-003, PBI-002
- Must merge before: PBI-034

#### Context
Read: `docs/scaffolding.md` — Section 9 (CI Workflow)

#### Verification
- [ ] Workflow triggers on push to `main` and pull requests to `main`
- [ ] Jobs: `check` (lint, typecheck, test) and `build` (matrix: ubuntu, windows, macos)
- [ ] `build` job depends on `check` passing
- [ ] Node.js 20 with pnpm cache
- [ ] Coverage uploaded to Codecov

#### Refinement Protocol
None.

---

### PBI-034: Add GitHub Actions release workflow

#### Directive
Create `.github/workflows/release.yml` triggered by version tags (`v*`). Build and package for all platforms, upload artifacts, publish to GitHub Releases.

**Scope:**
- `.github/workflows/release.yml`

#### Dependencies
- Blocked by: PBI-032, PBI-033
- Must merge before: None

#### Context
Read: `docs/scaffolding.md` — Section 9 (Release Workflow)

#### Verification
- [ ] Triggers on `v*` tags
- [ ] Matrix build: ubuntu, windows, macos
- [ ] Platform-specific build commands used
- [ ] Artifacts uploaded with 5-day retention
- [ ] Publishes to GitHub Releases via `softprops/action-gh-release`

#### Refinement Protocol
None.

---

## Layer 0 — Agent Context (parallel with everything)

### PBI-035: Create AGENTS.md and CLAUDE.md symlink

#### Directive
Create `AGENTS.md` following the seven-part structure defined in the scaffolding guide. Create `CLAUDE.md` as a symlink to `AGENTS.md`. Add `CLAUDE.local.md` to `.gitignore`.

**Scope:**
- `AGENTS.md`
- `CLAUDE.md` (symlink)
- `.gitignore` (add `CLAUDE.local.md`)

#### Dependencies
- Blocked by: PBI-005
- Must merge before: None (but should be done early for agent context)

#### Context
Read: `docs/scaffolding.md` — Section 11 (Agent Context Files)

#### Verification
- [ ] `AGENTS.md` contains all 7 parts: Mission, Personas, Tech Stack, Boundaries, Directory Map, Command Registry, Coding Standards
- [ ] `CLAUDE.md` is a symlink → `AGENTS.md` (verified via `ls -la`)
- [ ] `.gitignore` includes `CLAUDE.local.md`
- [ ] Both files are tracked in git

#### Refinement Protocol
Content will evolve as the project matures — this is the initial version.

---

## Layer 0 — Project Infrastructure (scaffolding-only, not spec-derived)

### PBI-037: Create .gitignore

#### Directive
Create a comprehensive `.gitignore` for the project covering build artifacts, dependencies, OS files, editor files, and project-specific ignores.

**Scope:**
- `.gitignore`

#### Dependencies
- Blocked by: None (should be the very first commit)
- Must merge before: All other PBIs (prevents accidental commits of artifacts)

#### Context
Read: `docs/scaffolding.md` — Section 2 (Repository Structure, implied by `dist/`, `node_modules/` references)

#### Verification
- [x] Ignores `node_modules/`
- [x] Ignores `dist/`
- [x] Ignores `release/` (electron-builder output)
- [x] Ignores `coverage/` (vitest coverage output)
- [x] Ignores OS files (`.DS_Store`, `Thumbs.db`)
- [x] Ignores editor files (`.vscode/`, `.idea/`, `*.swp`)
- [x] Ignores `CLAUDE.local.md` (personal agent overrides)
- [x] Ignores `.env` and `.env.*`
- [x] Does NOT ignore `*.plan` files (they are source data)
- [x] `git status` does not show ignored file types after creation

#### Refinement Protocol
None.

---

### PBI-038: Create README.md

#### Directive
Create a `README.md` with project name, one-line description, tech stack summary, quick start instructions (`pnpm install`, `pnpm dev`, `pnpm test`), and links to `docs/scaffolding.md` and `AGENTS.md` for further reading.

**Scope:**
- `README.md`

#### Dependencies
- Blocked by: PBI-001 (needs package.json for install instructions to be accurate)
- Must merge before: None

#### Context
Read: `docs/scaffolding.md` — Section 1 (Overview) and Section 2 (Repository Structure lists README.md)

#### Verification
- [x] `README.md` exists in repo root
- [x] Contains project name "Partial" and one-line description
- [x] Lists the tech stack (Node.js, TypeScript, Electron, Svelte, D3)
- [x] Contains quick start: clone, `pnpm install`, `pnpm dev`
- [x] Contains test command: `pnpm test`
- [x] Links to `docs/scaffolding.md` for full setup
- [x] Links to `AGENTS.md` for agent contributors
- [x] Contains MIT license badge or reference

#### Refinement Protocol
None — this is a minimal initial README that will evolve.

---

### PBI-039: Create electron-vite configuration

#### Directive
Create `electron.vite.config.ts` (or equivalent) configuring electron-vite for the project. Define build entries for main process, preload, and renderer. Configure the Svelte Vite plugin for the renderer. Set up path alias resolution matching `tsconfig.json`.

**Scope:**
- `electron.vite.config.ts`

#### Dependencies
- Blocked by: PBI-001, PBI-002
- Must merge before: PBI-019 (Electron main entry needs this to run)

#### Context
Read: `docs/scaffolding.md` — Section 3 (`"dev": "electron-vite dev"`, `"build": "electron-vite build"`)

#### Verification
- [x] `electron.vite.config.ts` exists and is valid TypeScript
- [x] Defines `main`, `preload`, and `renderer` build entries
- [x] Renderer config includes `@sveltejs/vite-plugin-svelte`
- [x] Path aliases (`@shared/*`, `@main/*`, `@renderer/*`) resolve correctly
- [x] `pnpm exec electron-vite build` does not error on config parsing (may fail on missing source files — that's expected)

#### Refinement Protocol
If electron-vite's config API differs from expectation, adapt to current API and document.

---

### PBI-040: Create Vitest configuration

#### Directive
Create Vitest configuration for the project. Configure path alias resolution matching `tsconfig.json`. Set up coverage provider (`@vitest/coverage-v8`). Ensure `pnpm test` and `pnpm test:coverage` work.

**Scope:**
- `vitest.config.ts` (or vitest section in `vite.config.ts`)

#### Dependencies
- Blocked by: PBI-001, PBI-002
- Must merge before: PBI-042, PBI-007 (first PBI that creates tests)

#### Context
Read: `docs/scaffolding.md` — Section 3 (`"test": "vitest"`, `"test:coverage": "vitest --coverage"`)

#### Verification
- [x] `pnpm test -- --run` executes without config errors (may report "no tests found" — that's expected)
- [x] `pnpm test:coverage` executes with v8 coverage provider
- [x] Path aliases (`@shared/*`, `@main/*`) resolve in test files
- [x] Coverage output goes to `coverage/` directory
- [x] Config excludes `node_modules/`, `dist/`, and `e2e/` from test collection

#### Refinement Protocol
If vitest requires specific configuration for Svelte component testing, add it and note.

---

### PBI-041: Create sample .plan fixture files

#### Directive
Create a set of `.plan` fixture files in `tests/fixtures/` for use across all test suites (parser, DAG, CLI, watcher). Cover common and edge-case plan structures.

**Scope:**
- `tests/fixtures/minimal.plan` — Minimum valid plan (version, project, one task)
- `tests/fixtures/complex.plan` — Multiple tasks with dependencies, all four dependency types
- `tests/fixtures/unknown-fields.plan` — Plan with unknown fields at root and task level
- `tests/fixtures/empty.plan` — Empty file
- `tests/fixtures/invalid-yaml.plan` — Malformed YAML for error-path testing
- `tests/fixtures/cyclic.plan` — Tasks with circular dependencies

#### Dependencies
- Blocked by: PBI-005 (directory structure needs to exist)
- Must merge before: PBI-010, PBI-012 (tests that need fixtures)

#### Context
Read: `plans/plan-parser/spec.md` — Contract → Scenarios (all scenarios define implicit fixture needs)
Read: `plans/dag-engine/spec.md` — Contract → Scenarios (cycle, diamond, linear, disconnected)

#### Verification
- [x] `tests/fixtures/minimal.plan` is valid YAML with `version`, `project`, and at least one task
- [x] `tests/fixtures/complex.plan` has tasks using `needs`, `needs_fs`, `needs_ss`, `needs_ff`, `needs_sf`
- [x] `tests/fixtures/unknown-fields.plan` has `custom_metadata` at root and `priority` on a task
- [x] `tests/fixtures/empty.plan` is an empty file (0 bytes)
- [x] `tests/fixtures/invalid-yaml.plan` contains intentionally broken YAML
- [x] `tests/fixtures/cyclic.plan` has tasks with a circular dependency (A → B → C → A)
- [x] All valid `.plan` files parse successfully with the `yaml` package

#### Refinement Protocol
Add additional fixtures as new edge cases are discovered during testing.

---

### PBI-042: Add Vitest test setup and helpers

#### Directive
Create shared test utilities: a helper to load fixture files by name, a helper to create in-memory `PlanFile` objects for tests, and any necessary Vitest setup files (e.g., global setup/teardown for temp directories in watcher tests).

**Scope:**
- `tests/helpers.ts` (new file — shared test utilities)
- `tests/setup.ts` (new file — Vitest global setup, if needed)
- Update `vitest.config.ts` to reference setup file if created

#### Dependencies
- Blocked by: PBI-040
- Must merge before: PBI-007 (first PBI that writes tests, benefits from helpers)

#### Context
Read: `plans/plan-parser/spec.md` — Contract (testing scenarios inform what helpers are needed)
Read: `plans/file-watcher/spec.md` — Contract (watcher tests need temp directory helpers)

#### Verification
- [ ] `loadFixture(name: string): string` reads a fixture file from `tests/fixtures/` and returns contents
- [ ] `createPlan(overrides?: Partial<PlanFile>): PlanFile` builds a typed `PlanFile` with sensible defaults
- [ ] `createTask(overrides?: Partial<Task>): Task` builds a typed `Task` with sensible defaults
- [ ] Helpers are importable from test files via `tests/helpers`
- [ ] `pnpm test -- --run` still passes (no test config regressions)

#### Refinement Protocol
Add helpers as needed when downstream PBIs reveal common test patterns.

---

### PBI-043: Create demo .plan file (dogfood)

#### Directive
Create `demo/partial.plan` — Partial's own backlog modeled as a `.plan` file. This exercises the full schema (dependencies, parent grouping, extended `type` field, unknown `metadata` field) and serves as a real-world smoke test for the parser, DAG engine, and all three views.

**Scope:**
- `demo/partial.plan`

#### Dependencies
- Blocked by: PBI-005 (directory structure)
- Must merge before: None (but useful as an early integration test once parser and views are built)

#### Context
Read: `plans/backlog.md` — Dependency Graph (the `.plan` file should faithfully model this DAG)
Read: `docs/scaffolding.md` — Section 10 (types.ts schema: `version`, `project`, `tasks[].id`, `tasks[].title`, `tasks[].done`, `tasks[].needs`, `tasks[].parent`)

#### Verification
- [ ] `demo/partial.plan` is valid YAML
- [ ] Contains `version: "1.0.0"` and `project: Partial`
- [ ] All 42 PBIs are represented as tasks with correct `id`, `title`, `needs`, `parent`
- [ ] Dependency edges match `plans/backlog.md` dependency graph exactly
- [ ] Uses extended fields (`type`, `parent`) to demonstrate forward-compatible schema
- [ ] Uses an unknown root-level field (`metadata`) to exercise round-trip preservation
- [ ] Parseable by the `yaml` npm package without errors
- [ ] When loaded into the Gantt/Kanban/Graph views, produces a meaningful visualization of Partial's own build plan

#### Refinement Protocol
Update `demo/partial.plan` whenever PBIs are added, removed, or re-ordered in the backlog. Same-commit rule applies.

---

## Execution Notes

### Parallelism Opportunities

The following PBI groups can be worked on concurrently by independent agents:

| Track | PBIs | Isolation |
|-------|------|-----------|
| **Infra/Config** | 037, 038, 039, 040 → 042 | Root config files |
| **Parser** | 008 → 009 → 010 | `src/main/parser.ts`, `tests/main/parser*` |
| **DAG** | 011 → 012, 013, 014, 015 | `src/shared/dag.ts`, `tests/shared/dag*` |
| **CLI** | 028 → 029, 030, 031 | `src/cli/`, `tests/cli/` |
| **Electron** | 019 → 020 → 021, 022 → 023 | `src/main/index.ts`, `src/renderer/` |
| **Views** | 025, 026, 027 | Each in its own `views/*.svelte` file |
| **CI/CD** | 033, 034 | `.github/workflows/` |
| **Agent Context** | 035, 036 | `AGENTS.md`, `.github/` |
| **Test Infra** | 041, 042 | `tests/fixtures/`, `tests/helpers.ts` |

### Suggested Sprint Sequence

**Sprint 1 (Foundation):** PBI-037, PBI-001 → PBI-005, PBI-038, PBI-039, PBI-040, PBI-041, PBI-042, PBI-035, PBI-036
**Sprint 2 (Shared Logic):** PBI-006, PBI-007
**Sprint 3 (Core Engine):** PBI-008 through PBI-015
**Sprint 4 (Integration):** PBI-016 through PBI-024, PBI-028, PBI-033
**Sprint 5 (Features):** PBI-025 through PBI-031
**Sprint 6 (Release):** PBI-032, PBI-034
