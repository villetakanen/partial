# Project Partial — v0.3.0 Product Backlog

> **Theme:** "Editable & Extensible" — Make Partial a read-write tool, not just a viewer.
> **Format:** ASDLC PBI pattern (Directive + Context Pointer + Verification + Refinement)
> **Ordering:** Dependency-resolved; items higher in the list can be started first.
> **Atomicity:** Each PBI produces a single committable, testable increment.
> **Base:** All v0.2.0 PBIs (044–056) are complete. v0.3.0 PBIs start at 057.

---

## Motivation

v0.2.0 made Partial a standalone desktop app that can open, watch, and render `.plan` files.
But the app is **read-only** — users edit `.plan` files in a text editor and watch Partial
react. v0.3.0 closes this gap by adding in-app editing, accessibility foundations, and CLI
improvements for agent composability.

### Carried forward from v0.2.0 "Deferred" list

| Item | Status for v0.3.0 |
|------|--------------------|
| Biome Svelte overrides (Finding 3) | Still waiting on upstream — defer to v0.4.0 |
| Gantt time axis (Finding 5) | Requires date/duration ADR — **included as stretch** |
| HF-4: Inline editing / settings UI | **Primary theme of v0.3.0** |
| Project-level `statuses` config | Requires ADR — **included as foundation** |

### New findings from v0.2.0 team review

| Finding | Severity | Root Cause |
|---------|----------|------------|
| White border on left/top of app | Medium | No CSS reset — browser default `body { margin: 8px }` shows white behind dark `<main>` |
| Content overflows window, bad UX | Medium | `width: 100%` + `padding: 1rem` without `box-sizing: border-box`; no global sizing reset |
| Color scheme hardcoded across 6 components | Medium | ~50+ hex values scattered without shared tokens; no theming infrastructure |

---

## Dependency Graph

```
PBI-057 (ADR: task dates)          ← None
PBI-058 (ADR: project statuses)   ← None
PBI-059 (done toggle editing)     ← None
PBI-060 (title inline editing)    ← PBI-059
PBI-061 (new task creation)       ← PBI-060
PBI-062 (task deletion)           ← PBI-059
PBI-063 (settings panel)          ← PBI-058
PBI-064 (keyboard nav + focus)    ← None
PBI-065 (ARIA labels & roles)     ← PBI-064
PBI-066 (CLI DOT export)          ← None
PBI-067 (Gantt time axis)         ← PBI-057    [stretch]
PBI-068 (v0.3.0 demo plan)       ← PBI-059, PBI-065
PBI-069 (CSS reset + body fix)    ← None
PBI-070 (overflow + box-sizing)   ← PBI-069
PBI-071 (design tokens)           ← PBI-069
```

---

## P0 — Critical (core editing loop)

### PBI-059: Add inline done-toggle editing to TaskCard

#### Directive
Add a clickable done-toggle (checkbox or status dot click) to the `TaskCard` component. Clicking it flips the `done` boolean and dispatches a `plan:save` IPC call with the updated plan. The file watcher's content-hash check (PBI-052) ensures the save doesn't trigger a redundant re-parse.

**Scope:**
- `src/renderer/components/TaskCard.svelte` (add click handler on status dot)
- `src/renderer/App.svelte` (wire save dispatch)
- `src/shared/types.ts` (no changes — `done` already exists)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-060, PBI-061, PBI-062

#### Context
Read: `docs/0.1.0-findings.md` — HF-4 (No way to manage project settings — inline editing recommended)
Read: `plans/electron-shell/spec.md` — IPC Channel Contract (`plan:save`)

#### Verification
- [x] Clicking the status dot on a not-done task sets `done: true` and saves
- [x] Clicking the status dot on a done task sets `done: false` and saves
- [x] The `.plan` file on disk is updated with the new `done` value
- [x] Unknown fields in the `.plan` file are preserved after save (round-trip safe)
- [x] The file watcher does NOT re-trigger a parse for the self-write
- [x] Optimistic UI: the card updates immediately, before the file write completes
- [x] Works in all three views (Kanban, Gantt, Graph)
- [x] `pnpm test -- --run` passes
- [x] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If save failures need to be surfaced to the user (e.g., file locked), defer error UX to a follow-up PBI. For now, log errors to console.

---

### PBI-060: Add inline title editing to TaskCard

#### Directive
Double-clicking (or pressing Enter on a focused card) activates an inline text input on the task title. Pressing Enter or blurring the input confirms the edit and dispatches `plan:save`. Pressing Escape cancels the edit.

**Scope:**
- `src/renderer/components/TaskCard.svelte` (add edit mode state, input element)

#### Dependencies
- Blocked by: PBI-059 (save-dispatch infrastructure)
- Must merge before: PBI-061

#### Context
Read: `plans/kanban-view/spec.md` — Anti-Patterns (Heavy DOM updates)

#### Verification
- [x] Double-click on title activates inline input pre-filled with current title
- [x] Enter confirms and saves; Escape cancels
- [x] Blur (click elsewhere) confirms and saves
- [x] Empty title is rejected (no save, revert to original)
- [x] Round-trip safety: unknown fields preserved
- [x] Input is auto-focused and text is selected on activation
- [x] Svelte 5 runes syntax, scoped styles
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If multi-field editing (type, parent, needs) is desired, defer to a follow-up PBI. This PBI is title-only.

---

### PBI-061: Add new task creation from UI

#### Directive
Add an "Add Task" button or affordance to the Kanban view (and optionally other views). Creates a new task with a generated ID (e.g., `task-{timestamp}`), empty title, `done: false`, and immediately enters inline title edit mode. The new task is appended to the plan's `tasks` array and saved.

**Scope:**
- `src/renderer/views/Kanban.svelte` (add button in Ready column header)
- `src/renderer/components/TaskCard.svelte` (support auto-edit-on-mount prop)

#### Dependencies
- Blocked by: PBI-060 (inline title editing must work)
- Must merge before: PBI-068

#### Context
Read: `docs/0.1.0-findings.md` — HF-4

#### Verification
- [ ] "Add Task" button visible in Kanban Ready column
- [ ] Clicking it creates a new task and enters edit mode on its title
- [ ] New task appears in the `.plan` file on disk
- [ ] Generated task ID is unique within the plan
- [ ] Canceling the title edit (Escape) removes the newly created task
- [ ] Round-trip safety: all other tasks and unknown fields preserved
- [ ] `pnpm test -- --run` passes

#### Refinement Protocol
If adding tasks with pre-set dependencies or parent is desired, defer to a follow-up PBI.

---

### PBI-062: Add task deletion from UI

#### Directive
Add a delete affordance (e.g., trash icon or context menu) to the `TaskCard` component. Deleting a task removes it from the `tasks` array and saves. If other tasks depend on the deleted task (`needs` references), show a confirmation warning listing the affected tasks.

**Scope:**
- `src/renderer/components/TaskCard.svelte` (delete button/icon)
- `src/renderer/App.svelte` (confirmation dialog logic)

#### Dependencies
- Blocked by: PBI-059 (save-dispatch infrastructure)
- Must merge before: PBI-068

#### Context
Read: `src/shared/dag.ts` — DAG traversal can identify dependents of a deleted task

#### Verification
- [ ] Delete button visible on TaskCard (on hover or always visible)
- [ ] Clicking delete on a task with no dependents removes it immediately
- [ ] Clicking delete on a task with dependents shows confirmation with affected task list
- [ ] Confirming deletion removes the task and clears it from all `needs` arrays
- [ ] Canceling deletion does nothing
- [ ] Round-trip safety: unknown fields preserved
- [ ] `pnpm test -- --run` passes

#### Refinement Protocol
If undo/redo is desired, defer to a separate PBI. This PBI is destructive-delete only.

---

## P1 — High (schema foundations & settings)

### PBI-057: ADR: Task date and duration fields for Gantt time axis

#### Directive
Write an Architecture Decision Record in `docs/decisions/` that proposes adding optional `start`, `due`, and `duration` fields to the Task schema. Evaluate format options (ISO 8601 dates, relative durations, sprint-based). Define how the Gantt view should transition from dependency-order to time-based layout. This ADR does NOT implement the change — it documents the decision for v0.3.0 or v0.4.0 implementation.

**Scope:**
- `docs/decisions/adr-001-task-dates.md` (new file)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-067

#### Context
Read: `docs/0.1.0-findings.md` — Finding 5 (Gantt uses unit positions)
Read: `plans/gantt-view/spec.md` — Blueprint → Context

#### Verification
- [ ] ADR follows the template: Title, Status, Context, Decision, Consequences
- [ ] At least two format options are compared with pros/cons
- [ ] Round-trip safety implications are addressed
- [ ] Zod schema update is sketched (not implemented)
- [ ] ADR is linked from the Gantt view spec

#### Refinement Protocol
If the team prefers to defer dates entirely, the ADR can conclude with "Deferred" status.

---

### PBI-058: ADR: Project-level statuses configuration

#### Directive
Write an ADR proposing a project-level `statuses` field in the `.plan` schema that defines which Kanban columns appear and what task `state` values map to them. Evaluate whether this should be a simple list or a richer structure with colors/icons.

**Scope:**
- `docs/decisions/adr-002-project-statuses.md` (new file)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-063

#### Context
Read: `docs/0.1.0-findings.md` — HF-3 (Kanban 4 cols vs 2 states)
Read: `plans/kanban-view/spec.md` — Column Logic table

#### Verification
- [ ] ADR follows the template: Title, Status, Context, Decision, Consequences
- [ ] Backward compatibility with current `done: true/false` + `state` field addressed
- [ ] Round-trip safety implications documented
- [ ] Example `.plan` snippet included showing the proposed syntax
- [ ] ADR is linked from the Kanban view spec

#### Refinement Protocol
None — ADR is a document, not code.

---

### PBI-063: Add project settings panel

#### Directive
Add a settings panel accessible from the app header (gear icon or menu item). Initially supports viewing and editing the `project` name and `version` fields from the `.plan` file metadata. Editing dispatches `plan:save` with the updated plan. The panel should be designed as an overlay/drawer that doesn't replace the current view.

**Scope:**
- `src/renderer/components/SettingsPanel.svelte` (new component)
- `src/renderer/App.svelte` (toggle settings panel, wire save)

#### Dependencies
- Blocked by: PBI-058 (ADR informs what settings fields to expose)
- Must merge before: PBI-068

#### Context
Read: `docs/0.1.0-findings.md` — HF-4 (No project settings UI)
Read: `src/shared/types.ts` — `PlanFile` interface

#### Verification
- [ ] Settings gear icon visible in app header
- [ ] Clicking it opens a panel/drawer overlay
- [ ] Project name is displayed and editable
- [ ] Version is displayed (read-only for now)
- [ ] Changes to project name are saved to the `.plan` file on confirm
- [ ] Panel can be closed without saving (cancel behavior)
- [ ] Round-trip safety: unknown fields preserved
- [ ] Svelte 5 runes syntax, scoped styles
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If custom statuses config (from PBI-058 ADR) is approved, the settings panel can be extended in a follow-up PBI.

---

## P2 — Medium (accessibility & CLI)

### PBI-064: Add keyboard navigation and focus management

#### Directive
Make all views keyboard-navigable. TaskCards should be focusable (`tabindex="0"`), arrow keys should navigate between cards within a view, and Enter should activate a card's primary action (done toggle or detail view). Add visible focus indicators.

**Scope:**
- `src/renderer/components/TaskCard.svelte` (tabindex, keydown handlers)
- `src/renderer/views/Kanban.svelte` (arrow key column/card navigation)
- `src/renderer/views/Gantt.svelte` (arrow key task navigation)
- `src/renderer/views/Graph.svelte` (arrow key node navigation)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-065

#### Context
Read: `plans/kanban-view/spec.md` — DoD: "Accessible: tasks are focusable"
Read: `plans/gantt-view/spec.md` — DoD: "Accessible: keyboard navigation for task selection"

#### Verification
- [ ] TaskCards have `tabindex="0"` and are reachable via Tab
- [ ] Arrow keys navigate between cards in Kanban columns
- [ ] Enter on a focused card toggles done state
- [ ] Visible focus ring/outline on focused cards
- [ ] Focus is not trapped — Tab escapes the card list to other UI elements
- [ ] Works with screen readers (VoiceOver on macOS tested)
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If full screen reader support requires ARIA live regions for dynamic updates, defer to a follow-up PBI.

---

### PBI-065: Add ARIA labels and landmark roles

#### Directive
Add semantic ARIA attributes across all views: `role="region"` with labels on view containers, `role="list"` / `role="listitem"` on Kanban columns and cards, `aria-label` on interactive elements (status dots, navigation buttons, settings button). Add `aria-live="polite"` on the plan status area so screen readers announce file changes.

**Scope:**
- `src/renderer/views/Kanban.svelte`
- `src/renderer/views/Gantt.svelte`
- `src/renderer/views/Graph.svelte`
- `src/renderer/components/TaskCard.svelte`
- `src/renderer/App.svelte`

#### Dependencies
- Blocked by: PBI-064 (keyboard nav establishes focus model)
- Must merge before: PBI-068

#### Context
Read: `plans/kanban-view/spec.md` — DoD: "columns are labeled with ARIA roles"
Read: `plans/gantt-view/spec.md` — DoD: "ARIA labels on chart elements"

#### Verification
- [ ] Each view container has `role="region"` with `aria-label`
- [ ] Kanban columns have `role="list"`, cards have `role="listitem"`
- [ ] Status dots have `aria-label` describing the state
- [ ] Navigation buttons have `aria-label`
- [ ] Plan status area has `aria-live="polite"`
- [ ] axe-core automated audit shows no critical violations
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If axe-core integration as a test is desired, create a follow-up PBI for `vitest-axe`.

---

### PBI-066: Add DOT format export to CLI graph command

#### Directive
Extend the `partial graph` command to support `--format dot` which outputs the dependency graph in Graphviz DOT format. This enables piping to `dot`, `fdp`, or other Graphviz tools for custom rendering. The default text format remains unchanged.

**Scope:**
- `src/cli/index.ts` (add `--format` flag to graph command)

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `plans/cli/spec.md` — Graph output scenario
Read: `src/shared/dag.ts` — Graph data structure

#### Verification
- [ ] `partial graph plan.plan --format dot` outputs valid DOT syntax
- [ ] DOT output includes node labels (task titles) and directed edges
- [ ] Done tasks are styled differently in DOT output (e.g., filled gray)
- [ ] Default `partial graph plan.plan` output is unchanged (no breaking change)
- [ ] DOT output can be piped to `dot -Tpng` to produce a valid image
- [ ] `--json` flag still works alongside `--format`
- [ ] Unit tests cover DOT generation
- [ ] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If SVG direct export is desired (without external Graphviz), defer to a follow-up PBI.

---

## P1 — High (visual bugs & theming)

### PBI-069: Add CSS reset and fix body margin/padding

#### Directive
The app shows a white border on the left and top edges because `index.html` has no CSS reset — the browser default `body { margin: 8px }` creates a white gap between the viewport edge and the dark `<main>` background (`#1a1a2e`). Fix by adding a minimal CSS reset: zero out `body`/`html` margin and padding, set `background` to match the app surface color, and add `box-sizing: border-box` globally. Remove the `padding: 1rem` from `<main>` in `App.svelte` and apply it only to the content areas that need it.

**Scope:**
- `src/renderer/index.html` (add `<style>` reset in `<head>`)
- `src/renderer/App.svelte` (adjust `<main>` padding to use inner containers)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-070, PBI-071

#### Context
Root cause: `index.html:12` has bare `<body>` with no styles. `App.svelte:55` sets `padding: 1rem` on `<main>` with `width: 100%`, and the browser's default `body { margin: 8px }` shows white background around the dark app.

#### Verification
- [x] No white border visible at any edge of the window
- [x] `<body>` and `<html>` have zero margin and padding
- [x] `box-sizing: border-box` is set globally via `*, *::before, *::after`
- [x] App background color extends fully to all window edges
- [x] Welcome screen still centers correctly
- [x] All three views still render with appropriate spacing
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
None — this is a CSS fix.

---

### PBI-070: Fix content overflow and window conformance

#### Directive
Content overflows the window in several scenarios: `<main>` width is `100% + 2rem` (padding without border-box), Kanban columns have `min-width: 200px × 4 = 800px` minimum that breaks at narrow widths, and Gantt label column is fixed at 180px. Fix by ensuring all layouts respect the viewport bounds: use `overflow: hidden` on the root, `overflow-x: auto` on scrollable areas, and clamp minimum widths to available space. Verify all views at 1024px, 1280px, and 1920px.

**Scope:**
- `src/renderer/App.svelte` (root container overflow)
- `src/renderer/views/Kanban.svelte` (column min-widths at narrow viewports)
- `src/renderer/views/Gantt.svelte` (label column responsiveness)

#### Dependencies
- Blocked by: PBI-069 (CSS reset and box-sizing must land first)
- Must merge before: PBI-068

#### Context
`App.svelte:53-55`: `width: 100%` + `padding: 1rem` = content wider than viewport.
`Kanban.svelte:95`: `min-width: 200px` per column × 4 columns = 800px hard minimum.
`Gantt.svelte:18`: `LABEL_WIDTH = 180` is fixed regardless of window size.

#### Verification
- [x] No horizontal scrollbar appears on the `<body>` or `<main>` at any window size
- [x] Kanban view gracefully wraps or scrolls at window widths below 800px
- [x] Gantt label column shrinks or truncates gracefully at narrow widths
- [x] Graph view SVG fills available height (already uses `calc(100vh - 8rem)`)
- [x] Tested at 1024px, 1280px, 1440px, 1920px window widths
- [x] No content is clipped or inaccessible
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If a minimum supported window width needs to be documented, set it at 800px.

---

### PBI-071: Extract color scheme to CSS custom properties (design tokens)

#### Directive
Extract all hardcoded hex color values across the 6 component files into CSS custom properties defined on `:root` in a shared location. Group tokens semantically: surface colors (`--color-surface-*`), text colors (`--color-text-*`), status colors (`--color-status-done`, `--color-status-ready`, `--color-status-blocked`, `--color-status-in-progress`), border colors (`--color-border-*`), and accent colors. Define the tokens in a single `src/renderer/theme.css` file imported by `main.ts`. Replace all hardcoded hex values in component `<style>` blocks with `var(--token-name)`.

**Scope:**
- `src/renderer/theme.css` (new file — CSS custom properties)
- `src/renderer/main.ts` (import `theme.css`)
- `src/renderer/App.svelte` (replace hex values with vars)
- `src/renderer/components/TaskCard.svelte` (replace hex values)
- `src/renderer/components/Welcome.svelte` (replace hex values)
- `src/renderer/views/Kanban.svelte` (replace hex values)
- `src/renderer/views/Gantt.svelte` (replace hex values)
- `src/renderer/views/Graph.svelte` (replace hex values)

#### Dependencies
- Blocked by: PBI-069 (CSS reset establishes the base styles)
- Must merge before: PBI-068

#### Context
Current state: ~50+ unique hex color values scattered across 6 files. Same semantic color (e.g., `#e0e0e0` for primary text) repeated 4+ times. No shared reference, no path to theming or dark/light mode switching.

#### Verification
- [ ] `src/renderer/theme.css` defines all color tokens as CSS custom properties on `:root`
- [ ] Zero hardcoded hex color values remain in component `<style>` blocks
- [ ] All tokens use semantic naming (not `--color-1a1a2e` but `--color-surface-primary`)
- [ ] App looks identical before and after (visual regression: no color changes)
- [ ] Token file is organized by category with comments
- [ ] A future dark/light theme switch could be done by swapping `:root` values
- [ ] Graph.svelte `nodeColor()` function uses token values (via `getComputedStyle` or passed as props)
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm check` passes

#### Refinement Protocol
If CSS-in-JS access to tokens is needed (e.g., for D3 `nodeColor()`), define a parallel `themeTokens` TypeScript const in `src/renderer/themeTokens.ts` that mirrors the CSS values. ASK before adding this extra file.

---

## P3 — Stretch (time-axis Gantt)

### PBI-067: Implement Gantt time axis with date fields

#### Directive
If PBI-057 ADR is accepted, implement the schema changes (Zod + types) and update the Gantt view to use `d3.scaleTime` when date fields are present. Fall back to dependency-order layout when no dates are specified.

**Scope:**
- `src/shared/types.ts` (add optional date fields per ADR)
- `src/shared/schemas.ts` (update Zod schema)
- `src/renderer/views/Gantt.svelte` (conditional time axis)

**Spec Amendments Required:**
- `plans/gantt-view/spec.md` — Major update to Architecture and DoD

#### Dependencies
- Blocked by: PBI-057 (ADR must be accepted, not just written)
- Must merge before: None

#### Context
Read: `docs/decisions/adr-001-task-dates.md` (written in PBI-057)
Read: `plans/gantt-view/spec.md`

#### Verification
- [ ] Tasks with `start`/`due` dates render on a time axis
- [ ] Tasks without dates fall back to dependency-order positioning
- [ ] Mixed plans (some tasks with dates, some without) render coherently
- [ ] Zod schema validates date formats per ADR
- [ ] Round-trip safety: date fields preserved and re-serialized correctly
- [ ] Unknown fields still preserved
- [ ] `pnpm test -- --run` passes
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If the ADR is deferred or rejected, this PBI is dropped from v0.3.0.

---

## P3 — Quality / Foundation

### PBI-068: Create v0.3.0 demo .plan file

#### Directive
Create a fresh `demo/partial.plan` for v0.3.0 containing only v0.3.0 PBIs. Old v0.1.0 and v0.2.0 items should NOT be included — this is a clean iteration plan. Update the metadata to reflect v0.3.0.

**Scope:**
- `demo/partial.plan` (overwrite with v0.3.0 content only)

#### Dependencies
- Blocked by: PBI-059, PBI-065, PBI-070, PBI-071 (need stable PBI IDs, scope, and design tokens)
- Must merge before: None (last PBI in the release)

#### Context
Read: This backlog (plans/backlog-v0.3.0.md)

#### Verification
- [ ] Only v0.3.0 PBIs (057–068) are present as tasks
- [ ] No v0.1.0 or v0.2.0 items carried over
- [ ] Dependency edges match this backlog's dependency graph
- [ ] Metadata reflects v0.3.0
- [ ] File parses without errors: `pnpm exec tsx src/cli/index.ts validate demo/partial.plan`
- [ ] Round-trip safe (unknown fields in metadata preserved)

#### Refinement Protocol
Update this file as PBIs are completed during the release cycle.

---

## Execution Notes

### Parallelism Opportunities

| Track | PBIs | Isolation |
|-------|------|-----------|
| **CSS Foundations** | 069 → 070, 071 | `index.html`, `theme.css`, all `<style>` blocks |
| **ADRs (docs only)** | 057, 058 | `docs/decisions/` |
| **Editing Core** | 059 → 060 → 061, 062 | `TaskCard.svelte`, `App.svelte` |
| **Settings** | 063 | `SettingsPanel.svelte` (new) |
| **Accessibility** | 064 → 065 | All views + TaskCard |
| **CLI** | 066 | `src/cli/index.ts` |
| **Gantt Time Axis** | 067 | `types.ts`, `Gantt.svelte` (stretch) |
| **Dogfood** | 068 | `demo/partial.plan` |

### Suggested Sprint Sequence

**Sprint 1 (CSS & Foundations):** PBI-069, PBI-057, PBI-058, PBI-064, PBI-066
**Sprint 2 (Theming & Editing):** PBI-070, PBI-071, PBI-059
**Sprint 3 (Editing cont.):** PBI-060 → PBI-061, PBI-062
**Sprint 4 (Polish):** PBI-063, PBI-065
**Sprint 5 (Stretch + Release):** PBI-067 (if ADR accepted), PBI-068

### Acceptance Gate (v0.3.0 Release Criteria)

- `pnpm check` passes
- `pnpm exec tsc --noEmit` passes
- `pnpm test -- --run` passes (including new editing tests)
- No white border or content overflow at any window size
- All colors use CSS custom properties (zero hardcoded hex in components)
- User can toggle task done state from the UI
- User can edit task titles inline
- User can create and delete tasks from the UI
- All views are keyboard-navigable
- `demo/partial.plan` loads and renders correctly in all views
- CLI `partial graph --format dot` produces valid DOT output

### Deferred to v0.4.0

| Item | Reason |
|---------|--------|
| Biome Svelte overrides (Finding 3) | Still waiting on upstream support |
| Drag-and-drop Kanban reordering | Complex interaction; editing foundation needed first |
| Undo/redo for edits | Requires command pattern architecture |
| Custom statuses in Kanban columns | Depends on PBI-058 ADR outcome |
| Multi-field task editing (type, parent, needs) | Editing foundation (title/done) ships first |
| Error toast/notification UI for save failures | Editing must work before error UX is polished |
