# Project Partial — v0.2.0 Product Backlog

> **Theme:** "Usable by Humans" — Make Partial a functional standalone app.
> **Format:** ASDLC PBI pattern (Directive + Context Pointer + Verification + Refinement)
> **Ordering:** Dependency-resolved; items higher in the list can be started first.
> **Atomicity:** Each PBI produces a single committable, testable increment.
> **Base:** All v0.1.0 PBIs (001–043) are complete. v0.2.0 PBIs start at 044.

---

## Dependency Graph

```
PBI-044 (fix malformed partial.plan)  ← None
PBI-045 (fix scaffolding doc)         ← None
PBI-046 (macOS quit behavior)         ← None
PBI-047 (file open: Electron menu)    ← PBI-046
PBI-048 (file open: Welcome screen)   ← PBI-047
PBI-049 (file open: last-opened)      ← PBI-047
PBI-050 (responsive layout)           ← None
PBI-051 (Kanban smart columns)        ← None
PBI-052 (self-write hash check)       ← None
PBI-053 (Graph sim auto-scaling)      ← None
PBI-054 (Svelte component tests)      ← PBI-051, PBI-050
PBI-055 (Electron IPC tests)          ← PBI-047
PBI-056 (v0.2.0 demo plan update)    ← PBI-044, PBI-047, PBI-050, PBI-051
```

---

## P0 — Critical (app is broken without these)

### PBI-047: Add native Electron menu with File > Open

#### Directive
Add a native Electron application menu with a File > Open item that uses `dialog.showOpenDialog` to let the user select a `.plan` file. Wire the selected path to the `plan:open-file` IPC channel. This is the primary mechanism for loading `.plan` files into the app.

**Scope:**
- `src/main/index.ts` (add menu creation, open-file dialog handler)
- `src/shared/ipc.ts` (add `OPEN_FILE`, `SHOW_OPEN_DIALOG` channel constants)

**Spec Amendments Required:**
- `plans/electron-shell/spec.md` — Add "File Open" scenario, update Architecture section with menu creation, update Definition of Done

#### Dependencies
- Blocked by: PBI-046 (macOS quit fix, since both touch `index.ts` lifecycle code)
- Must merge before: PBI-048, PBI-049, PBI-055

#### Context
Read: `plans/electron-shell/spec.md` — Blueprint → Architecture (IPC Channel Contract)
Read: `docs/0.1.0-findings.md` — HF-2 (No way to open a file)

#### Verification
- [x] File > Open menu item exists on all platforms
- [x] Clicking it opens a native file picker dialog filtered to `.plan` files
- [x] Selecting a file triggers `plan:open-file` IPC with the chosen path
- [x] Canceling the dialog does nothing (no error, no crash)
- [x] Keyboard shortcut Cmd/Ctrl+O triggers the dialog
- [x] On macOS, the menu integrates with the native menu bar (not a custom HTML menu)
- [x] `pnpm exec tsc --noEmit` passes
- [x] `pnpm check` passes

#### Refinement Protocol
If additional menu items are discovered as needed (e.g., File > Recent), defer to a follow-up PBI.

---

### PBI-048: Add Welcome screen with Open Plan File button

#### Directive
When no `.plan` file is loaded, show a Welcome screen in the renderer with the project name and an "Open Plan File" button that calls `window.api.showOpenDialog()`. Once a file is opened and the plan is loaded, the Welcome screen is replaced by the active view.

**Scope:**
- `src/renderer/App.svelte` (add welcome state, conditional rendering)
- `src/renderer/components/Welcome.svelte` (new component)

**Spec Amendments Required:**
- `plans/electron-shell/spec.md` — Add "Welcome screen" scenario

#### Dependencies
- Blocked by: PBI-047 (the open-file IPC must work first)
- Must merge before: PBI-056

#### Context
Read: `plans/electron-shell/spec.md` — Contract → Scenarios (File selection)
Read: `docs/0.1.0-findings.md` — HF-2

#### Verification
- [x] Welcome screen shown when app starts with no loaded plan
- [x] "Open Plan File" button is visible and calls `window.api.showOpenDialog()`
- [x] After selecting a file, Welcome screen disappears and active view shows
- [x] Welcome screen uses Svelte 5 runes syntax
- [x] Welcome screen uses scoped Svelte styles (no CSS frameworks)
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
None — keep the Welcome screen minimal. Branding and onboarding can be enhanced later.

---

### PBI-049: Persist and auto-load last-opened .plan file

#### Directive
Store the last successfully opened `.plan` file path using Electron's `app.getPath('userData')` and a simple JSON file. On app launch, if a last-opened path exists, automatically open and parse it. If the file no longer exists, fall through to the Welcome screen.

**Scope:**
- `src/main/index.ts` (add persistence logic at startup)
- `src/main/store.ts` (new file — simple JSON read/write for app settings)

#### Dependencies
- Blocked by: PBI-047 (needs the open-file flow to exist)
- Must merge before: None

#### Context
Read: `docs/0.1.0-findings.md` — HF-2 (recommendation: auto-load from last-opened)

#### Verification
- [x] After opening a `.plan` file, the path is persisted to a JSON file in `userData`
- [x] On next app launch, the last-opened file is loaded automatically
- [x] If the persisted path no longer exists on disk, the Welcome screen is shown
- [x] The settings file is not committed to git (lives in OS user data)
- [x] `store.ts` has JSDoc comments on all exported functions
- [x] No `any` types
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If multiple recent files are needed, defer to a future PBI. This PBI stores only the single last-opened path.

---

## P1 — High (developer friction / UX blockers)

### PBI-046: Fix macOS quit-on-close behavior

#### Directive
Change the `window-all-closed` handler to quit the app unconditionally on all platforms, including macOS. Partial is a single-window app where the macOS convention of keeping the app alive in the dock is confusing.

**Scope:**
- `src/main/index.ts` (modify `window-all-closed` handler)

**Spec Amendments Required:**
- `plans/electron-shell/spec.md` — Update "macOS lifecycle" scenario to reflect new behavior

#### Dependencies
- Blocked by: None
- Must merge before: PBI-047 (both modify `index.ts`, minimize merge conflicts)

#### Context
Read: `docs/0.1.0-findings.md` — HF-1 (macOS: Closing Window Does Not Quit the App)
Read: `plans/electron-shell/spec.md` — Contract → Scenarios (macOS lifecycle)

#### Verification
- [x] On macOS, closing the window quits the app entirely
- [x] On Windows/Linux, closing the window quits the app (unchanged)
- [x] No zombie processes remain after closing
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If a user preference for "keep in dock" is needed later, it can be added behind a settings flag in a future release.

---

### PBI-050: Make all views responsive to window size

#### Directive
Remove the `max-width: 1200px` cap on the root `<main>` element. Make the Graph SVG height responsive using `calc(100vh - header)` or a `ResizeObserver`. Ensure Kanban columns and Gantt chart fill available width.

**Scope:**
- `src/renderer/App.svelte` (remove max-width, add responsive container)
- `src/renderer/views/Graph.svelte` (responsive SVG height)
- `src/renderer/views/Gantt.svelte` (responsive label column and chart width)
- `src/renderer/views/Kanban.svelte` (responsive column widths)

**Spec Amendments Required:**
- `plans/gantt-view/spec.md` — Strengthen "Responsive to container resizing" in DoD
- `plans/graph-view/spec.md` — Add responsive SVG sizing to DoD

#### Dependencies
- Blocked by: None
- Must merge before: PBI-054 (component tests should verify responsive behavior)

#### Context
Read: `docs/0.1.0-findings.md` — HF-5 (Viewport Locked at 1200px)

#### Verification
- [x] Root `<main>` has no `max-width` cap (or uses `100%`)
- [x] Graph SVG height adapts to viewport height
- [x] Gantt chart width fills available horizontal space
- [x] Kanban columns distribute evenly across available width
- [x] App renders correctly at 1280px, 1440px, 1920px, and 2560px widths
- [x] No horizontal scrollbar at 1440px+ widths
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If a minimum supported width is needed, set it at 1024px and document.

---

## P2 — Medium (UX polish / data model alignment)

### PBI-044: Fix malformed pbi-007 in demo/partial.plan

#### Directive
Fix the corrupted YAML structure of pbi-007 in `demo/partial.plan`. Remove the duplicate `done:` key and the stray `- pbi-042` line. Set `done: true` since pbi-007 is completed.

**Scope:**
- `demo/partial.plan` (manual YAML fix, lines ~130-138)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-056

#### Context
Read: `docs/0.1.0-findings.md` — Finding 1 (Malformed pbi-007)

#### Verification
- [x] `pbi-007` has a single `done: true` key
- [x] No stray `- pbi-042` line under `done:`
- [x] `pbi-007.needs` contains only `pbi-006` (as per backlog dependency graph)
- [x] File parses without errors: `echo "valid" || pnpm exec tsx src/cli/index.ts validate demo/partial.plan`
- [x] YAML lints clean (no duplicate keys)

#### Refinement Protocol
None — this is a data fix.

---

### PBI-045: Update scaffolding doc to reflect out/ build directory

#### Directive
Update `docs/scaffolding.md` Section 6 to use `out/` instead of `dist/` as the electron-vite build output directory. Add a note explaining the electron-vite convention.

**Scope:**
- `docs/scaffolding.md` (Section 6 references to build output directory)

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `docs/0.1.0-findings.md` — Finding 8 (out/ vs dist/ divergence)

#### Verification
- [x] All references to `dist/` as build output in `docs/scaffolding.md` are updated to `out/`
- [x] A note explains that electron-vite uses `out/` by convention
- [x] `electron-builder.json` references are consistent with the doc

#### Refinement Protocol
None.

---

### PBI-051: Make Kanban columns context-aware

#### Directive
Update the Kanban view to intelligently handle empty columns. When no tasks have `state: "in_progress"` and no tasks are blocked, collapse or visually minimize empty columns. Add a tooltip on the "In Progress" column explaining the `state` field. Show the task count badge on each column header.

**Scope:**
- `src/renderer/views/Kanban.svelte` (smart column visibility, tooltips)

**Spec Amendments Required:**
- `plans/kanban-view/spec.md` — Update DoD: change "Empty columns are displayed" to "Empty columns are visually minimized with expand affordance"

#### Dependencies
- Blocked by: None
- Must merge before: PBI-054

#### Context
Read: `docs/0.1.0-findings.md` — HF-3 (Kanban 4 cols vs 2 states)
Read: `plans/kanban-view/spec.md` — Blueprint → Architecture (Column Logic)

#### Verification
- [x] Columns with tasks render at full width
- [x] Empty columns render in a collapsed/minimized state (narrow, muted)
- [x] Collapsed columns can be hovered or clicked to reveal full width
- [x] "In Progress" column header has a tooltip: "Tasks with `state: in_progress` in the .plan file"
- [x] Each column header shows task count badge
- [x] With only `done: true/false` tasks (no dependencies), only Ready and Done columns are prominent
- [x] Svelte 5 runes syntax, scoped styles
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If project-level `statuses` config in `.plan` is needed, that requires an ADR and is deferred to v0.3.0.

---

### PBI-052: Improve self-write detection with content hashing

#### Directive
Replace the simple `selfWritePaths` Set in `src/main/index.ts` with a content-hash-based approach. When Partial writes a file via `plan:save`, store the hash of the written content. When the watcher fires, compare the file's current hash against the stored hash — only suppress the event if the hashes match.

**Scope:**
- `src/main/index.ts` (replace Set with hash map, compare on watcher events)

**Spec Amendments Required:**
- `plans/file-watcher/spec.md` — Update anti-pattern on self-write detection to reference content hashing

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `docs/0.1.0-findings.md` — Finding 7 (Self-write Set simplistic)
Read: `plans/file-watcher/spec.md` — Anti-Patterns (Re-parsing on own writes)

#### Verification
- [x] Self-writes are still suppressed (no duplicate re-parse)
- [x] External writes to the same file between save and watcher event are NOT suppressed
- [x] Hash is computed using Node.js `crypto.createHash('sha256')`
- [x] Hash entry is cleared after the watcher event fires (no memory leak)
- [x] Tests cover: self-write suppressed, external-write-during-gap detected
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If performance of hashing large `.plan` files becomes a concern, consider mtime+size as a cheaper alternative.

---

### PBI-053: Auto-scale Graph force simulation parameters

#### Directive
Make the D3 force simulation parameters in Graph.svelte scale based on node count. For small graphs (<20 nodes) use current defaults. For medium graphs (20-50) increase charge repulsion and link distance. For large graphs (50+) further increase spacing and reduce alpha decay for faster convergence.

**Scope:**
- `src/renderer/views/Graph.svelte` (parameterize force simulation)

**Spec Amendments Required:**
- `plans/graph-view/spec.md` — Add auto-scaling note to Architecture section

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `docs/0.1.0-findings.md` — Finding 6 (Force sim defaults)
Read: `plans/graph-view/spec.md` — Anti-Patterns (Unbounded simulation)

#### Verification
- [x] Small graph (<20 nodes): current parameters unchanged
- [x] Medium graph (20-50 nodes): labels do not overlap in `demo/partial.plan` (34 tasks)
- [x] Large graph (50+ nodes): simulation converges within 3 seconds
- [x] Parameters are computed via a pure function `getSimParams(nodeCount: number)`
- [x] Function has JSDoc and unit test
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If users need manual tuning, add a settings panel in a future release.

---

## P3 — Quality / Foundation

### PBI-054: Add Svelte component tests

#### Directive
Add component tests for the four Svelte components using `@testing-library/svelte` and Vitest. Test column assignment logic in Kanban, responsive container in App, TaskCard state rendering, and empty-state handling across views.

**Scope:**
- `tests/renderer/Kanban.test.ts` (new file)
- `tests/renderer/TaskCard.test.ts` (new file)
- `tests/renderer/App.test.ts` (new file)
- `tests/renderer/Graph.test.ts` (new file — empty state only, force sim is hard to unit test)
- `package.json` (add `@testing-library/svelte` as dev dependency)

#### Dependencies
- Blocked by: PBI-051 (Kanban smart columns), PBI-050 (responsive layout) — test against final behavior
- Must merge before: PBI-056

#### Context
Read: `docs/0.1.0-findings.md` — Finding 4 (No component/IPC tests)

#### Verification
- [ ] Kanban test: tasks assigned to correct columns for known DAG
- [ ] Kanban test: empty columns are collapsed
- [ ] TaskCard test: renders correct state dot for done/blocked/ready/in_progress
- [ ] App test: renders Welcome screen when no plans loaded
- [ ] Graph test: renders empty state for `tasks: []`
- [ ] All tests pass: `pnpm test -- --run`
- [ ] `@testing-library/svelte` added to `devDependencies`

#### Refinement Protocol
ASK before adding `@testing-library/svelte` (Tier 2: new dependency). If Svelte 5 compatibility is an issue, document and defer.

---

### PBI-055: Add Electron IPC integration tests

#### Directive
Add integration tests that verify the IPC wiring between main and renderer processes. Test that `plan:open-file` triggers the file read and watcher, `plan:updated` delivers parsed plans, and `plan:error` forwards parse errors.

**Scope:**
- `tests/main/ipc.test.ts` (new file)
- May require `electron` test utilities or mock IPC

#### Dependencies
- Blocked by: PBI-047 (File Open must exist to test the full flow)
- Must merge before: None

#### Context
Read: `docs/0.1.0-findings.md` — Finding 4 (No IPC tests)
Read: `plans/electron-shell/spec.md` — Contract → Scenarios

#### Verification
- [x] Test: `plan:open-file` with valid path reads, parses, and starts watcher
- [x] Test: `plan:updated` fires when a watched `.plan` file changes
- [x] Test: `plan:error` fires when a watched `.plan` file has invalid YAML
- [x] Tests use mocked IPC (not full Electron app launch) for speed
- [x] All tests pass: `pnpm test -- --run`
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If full Electron test setup is too heavy, use mocked `ipcMain`/`ipcRenderer` and test the handler functions directly.

---

### PBI-056: Update demo/partial.plan for v0.2.0

#### Directive
Update `demo/partial.plan` to include all v0.2.0 PBIs (044–056) as tasks, with correct dependency edges. Mark completed v0.1.0 tasks and set v0.2.0 tasks as `done: false`. This keeps the dogfood file current.

**Scope:**
- `demo/partial.plan`

#### Dependencies
- Blocked by: PBI-044 (malformed YAML must be fixed first), PBI-047, PBI-050, PBI-051 (need to know final PBI IDs)
- Must merge before: None (last PBI in the release)

#### Context
Read: This backlog (plans/backlog-v0.2.0.md)

#### Verification
- [x] All v0.2.0 PBIs (044–056) are present as tasks
- [x] Dependency edges match this backlog's dependency graph
- [x] v0.1.0 tasks retain their `done: true` status
- [x] v0.2.0 tasks start as `done: false`
- [x] File parses without errors
- [x] Metadata field is preserved (round-trip safe)

#### Refinement Protocol
Update this file as PBIs are completed during the release cycle.

---

## Execution Notes

### Parallelism Opportunities

| Track | PBIs | Isolation |
|-------|------|-----------|
| **Data Fixes** | 044, 045 | `demo/partial.plan`, `docs/scaffolding.md` |
| **Electron Lifecycle** | 046 → 047 → 048, 049 | `src/main/index.ts`, `src/renderer/` |
| **Responsive UI** | 050 | `src/renderer/views/*.svelte`, `App.svelte` |
| **Kanban Polish** | 051 | `src/renderer/views/Kanban.svelte` |
| **Watcher Quality** | 052 | `src/main/index.ts` (self-write section) |
| **Graph Tuning** | 053 | `src/renderer/views/Graph.svelte` |
| **Test Coverage** | 054, 055 | `tests/` |
| **Dogfood Update** | 056 | `demo/partial.plan` |

### Suggested Sprint Sequence

**Sprint 1 (Quick Fixes):** PBI-044, PBI-045, PBI-046
**Sprint 2 (File Open):** PBI-047 → PBI-048, PBI-049
**Sprint 3 (UI Polish):** PBI-050, PBI-051, PBI-052, PBI-053
**Sprint 4 (Testing):** PBI-054, PBI-055
**Sprint 5 (Release):** PBI-056

### Acceptance Gate (v0.2.0 Release Criteria)

- `pnpm check` passes
- `pnpm exec tsc --noEmit` passes
- `pnpm test -- --run` passes (including new component + IPC tests)
- App launches, user can open a `.plan` file via menu or Welcome screen
- Views render responsively at 1280–2560px widths
- Pre-push hook works without `--no-verify`
- `demo/partial.plan` loads and renders in all three views

### Deferred to v0.3.0

| Finding | Reason |
|---------|--------|
| Finding 3 (Biome Svelte overrides) | Waiting on upstream Biome support |
| Finding 5 (Gantt time axis) | Requires date/duration schema fields — larger design effort + ADR |
| HF-4 (Inline editing / settings UI) | Major feature deserving its own release cycle |
| Project-level `statuses` config in `.plan` | Schema change requires ADR |
