# Project Partial — v0.4.0 Product Backlog

> **Theme:** "Polished & Discoverable" — Fix UX blind spots, brighten the theme, and add a full task detail panel.
> **Format:** ASDLC PBI pattern (Directive + Context Pointer + Verification + Refinement)
> **Ordering:** Dependency-resolved; items higher in the list can be started first.
> **Atomicity:** Each PBI produces a single committable, testable increment.
> **Base:** All v0.3.0 PBIs (057–071) are complete. v0.4.0 PBIs start at 072.

---

## Motivation

v0.3.0 made Partial read-write, but real usage surfaced five problems:

1. **Editing is hidden** — double-click/F2 to edit title has no visual affordance
2. **Colors are too muted** — desaturated palette, 50-60% done opacity, invisible borders
3. **Settings save bug** — project name edits don't persist to disk
4. **Description not editable** — exists in `.plan` files but not exposed in UI
5. **Kanban "In Progress" column** — hardcoded but meaningless for v1.0.0 `done/not-done` plans

### Carried forward from v0.3.0 "Deferred" list

| Item | Status for v0.4.0 |
|------|--------------------|
| Biome Svelte overrides | Still waiting on upstream — defer to v0.5.0 |
| Drag-and-drop Kanban reordering | Defer to v0.5.0 |
| Undo/redo for edits | Defer to v0.5.0 |
| Custom statuses in Kanban columns | Partially addressed by PBI-072 (3-col default) |
| Multi-field task editing | **Primary theme of v0.4.0** (detail panel) |
| Error toast/notification UI | Defer to v0.5.0 |

### User decisions

- **Kanban:** 3-column default (Blocked, Ready, Done); hide In Progress when empty
- **Theme:** brighten current dark theme — higher saturation, better contrast
- **Task detail:** full panel with editable fields (title, done, deps, dates, description)

---

## Dependency Graph

```
PBI-072 (Kanban 3-col)           ← None
PBI-073 (brighten theme)         ← None
PBI-074 (settings save bug)      ← None
PBI-075 (description schema)     ← None
PBI-076 (settings description)   ← PBI-074, PBI-075
PBI-077 (detail panel: basic)    ← PBI-074
PBI-078 (detail panel: deps)     ← PBI-077
PBI-079 (detail panel: dates)    ← PBI-077
PBI-080 (demo .plan)             ← PBI-072, PBI-073, PBI-076, PBI-079
```

---

## P0 — Bugs

### PBI-072: Kanban 3-column default — hide In Progress when empty

#### Directive
Change the Kanban view to show 3 columns by default: **Blocked**, **Ready**, **Done**. The "In Progress" column should only appear when at least one task has `state: "in_progress"` in the `.plan` file. Currently the column is always rendered (hardcoded 4th column), which confuses users since v1.0.0 `.plan` files use only `done: true/false` — nobody has `state: "in_progress"` tasks.

The column collapse behavior already exists (empty columns get the `.collapsed` class at `Kanban.svelte:131`). This PBI changes the logic so the In Progress column is **omitted entirely** from the `columns` array when it has zero tasks, rather than rendering as a collapsed column.

**Scope:**
- `src/renderer/views/Kanban.svelte` (filter out empty In Progress column)
- `tests/renderer/Kanban.test.ts` (add/update tests)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-080

#### Context
Read: `src/renderer/views/Kanban.svelte:35-66` — the `columns` `$derived` block builds 4 columns statically
Read: `docs/decisions/adr-002-project-statuses.md` — ADR on project-level statuses (deferred; current done/not-done is the only contract)

#### Verification
- [ ] Kanban shows 3 columns (Blocked, Ready, Done) when no tasks have `state: "in_progress"`
- [ ] Kanban shows 4 columns when at least one task has `state: "in_progress"`
- [ ] The "In Progress" column does not appear at all when empty (not collapsed, omitted)
- [ ] Existing collapse behavior for other empty columns is unchanged
- [ ] Column counts are correct
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm test -- --run tests/renderer/Kanban.test.ts` passes

#### Refinement Protocol
If custom statuses config (from PBI-058 ADR) is approved in a future version, the column filtering logic should be generalized. For now, hardcode the In Progress special case.

---

### PBI-074: Fix settings panel save not persisting

#### Directive
The settings panel's save handler has a bug: when `trimmed === plan.project`, the handler calls `onClose()` without saving. This means if the user opens settings, edits the name, then presses Save — but the plan data has been re-delivered by the watcher in the meantime (resetting `plan.project` back to the file's value) — the edit is silently dropped.

Root cause: `SettingsPanel.svelte:19` compares `trimmed` against the reactive `plan.project` prop. But `plan` is reactive and gets updated by the watcher. The local `projectName` state is initialized from `plan.project` on mount (line 14), but `plan.project` itself may have been refreshed by the time Save is clicked.

Fix: capture the initial project name on mount and compare against that, not the reactive prop. Also: always save when the user explicitly clicks Save (even if the value happens to match the current plan), because the user's intent is clear.

**Scope:**
- `src/renderer/components/SettingsPanel.svelte` (fix comparison logic)
- `tests/renderer/SettingsPanel.test.ts` (new — test save dispatch)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-076, PBI-077

#### Context
Read: `src/renderer/components/SettingsPanel.svelte:14-25` — the `handleSave()` function
Read: `src/renderer/App.svelte:153-157` — `handleSettingsSave` wires to `api.savePlan`

#### Verification
- [ ] Editing the project name and clicking Save dispatches `onSave` with the updated plan
- [ ] Save works even if the watcher has re-delivered the plan in the background
- [ ] Saving with an unchanged name still calls `onSave` (user clicked Save, honor intent)
- [ ] Empty project name is rejected (no save, no close — or revert to original)
- [ ] Cancel does not save
- [ ] Round-trip safety: unknown fields preserved in the saved plan
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm test -- --run tests/renderer/SettingsPanel.test.ts` passes

#### Refinement Protocol
None — this is a bug fix with a clear root cause and fix.

---

## P1 — Visual Polish

### PBI-073: Brighten dark theme — increase saturation and contrast

#### Directive
The current dark theme is too desaturated. Users report that done tasks are nearly invisible (opacity 0.5–0.6), borders are invisible against surfaces, and status colors blend into backgrounds. Brighten the theme by:

1. **Increase surface contrast**: widen the gap between `--color-surface-primary` and `--color-surface-card` / `--color-surface-elevated`
2. **Brighten text**: bump `--color-text-primary` from `#e0e0e0` to `#efefef`, `--color-text-secondary` from `#ccc` to `#d4d4d8`
3. **Increase status saturation**: boost status colors (done green, ready blue, blocked red, in-progress orange) by 10-15% lightness
4. **Increase done task readability**: raise `.done` opacity from `0.6` to `0.75` in TaskCard; raise `--color-text-done` from `#999` to `#b0b0b0`
5. **Visible borders**: bump `--color-border-primary` from `#333` to `#3d3d3d`, `--color-border-secondary` from `#444` to `#505050`
6. **Gantt/Graph improvements**: brighten bar fills, edge strokes, and node label contrast

**Scope:**
- `src/renderer/theme.css` (update CSS custom property values)
- `src/renderer/components/TaskCard.svelte` (adjust `.done` opacity)
- `src/renderer/views/Gantt.svelte` (adjust `.bar.done` opacity)
- `src/renderer/views/Graph.svelte` (adjust `.node.done` opacity)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-080

#### Context
Read: `src/renderer/theme.css` — current token values
Read: `src/renderer/components/TaskCard.svelte:249-252` — `.done { opacity: 0.6 }`
Read: `src/renderer/views/Gantt.svelte:484-487` — `.bar.done { opacity: 0.5 }`
Read: `src/renderer/views/Graph.svelte:382-384` — `.node.done { opacity: 0.5 }`

#### Verification
- [ ] All CSS custom properties updated in `theme.css`
- [ ] Done tasks are readable (opacity >= 0.7 across all views)
- [ ] Borders are visible against surfaces (clear edge between card and background)
- [ ] Status colors pop (done green, ready blue, blocked red are distinguishable at a glance)
- [ ] Text contrast meets WCAG AA (4.5:1 for normal text against surface)
- [ ] No hardcoded hex values introduced in component `<style>` blocks
- [ ] App looks noticeably brighter/crisper compared to v0.3.0
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm check` passes

#### Refinement Protocol
If any specific color choices are disputed, defer to user preference. The goal is a perceptible improvement, not pixel-perfect design.

---

## P2 — Features

### PBI-075: Add `description` field to PlanFile schema

#### Directive
Add an optional `description` field to the `PlanFile` interface and Zod schema. This allows `.plan` files to have a project description (e.g., `description: "Agent-native project management via .plan files"`). The field should be a simple string at the plan root level (not inside `metadata`).

The field already exists in many real `.plan` files under `metadata.description`, but having it at the root level makes it a first-class citizen that the SettingsPanel can edit directly.

**Scope:**
- `src/shared/types.ts` (add `description?: string` to `PlanFile`)
- `src/shared/schemas.ts` (add `description` to `PlanFileSchema`)
- `tests/shared/schemas.test.ts` (add tests for description field)

#### Dependencies
- Blocked by: None
- Must merge before: PBI-076

#### Context
Read: `src/shared/types.ts:14-20` — current `PlanFile` interface
Read: `src/shared/schemas.ts:39-45` — current `PlanFileSchema`

#### Verification
- [ ] `PlanFile` interface has `description?: string`
- [ ] `PlanFileSchema` validates `description` as optional string with `.passthrough()`
- [ ] Validation accepts plans with and without `description`
- [ ] Round-trip safety: `description` field preserved
- [ ] Round-trip safety: unknown fields still preserved (`.passthrough()` still works)
- [ ] JSDoc comment on the new field
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm test -- --run tests/shared/schemas.test.ts` passes

#### Refinement Protocol
If `description` should support multiline (YAML `|` syntax), document the limitation that Zod's string validator does not distinguish single-line from multi-line. The parser already handles YAML multiline strings.

---

### PBI-076: Add description editing to SettingsPanel

#### Directive
Extend the SettingsPanel to display and edit the project `description` field (added in PBI-075). Add a textarea field below the project name input. The description is optional — an empty textarea means no description field in the saved plan (do not save an empty string).

**Scope:**
- `src/renderer/components/SettingsPanel.svelte` (add textarea field, update save logic)

#### Dependencies
- Blocked by: PBI-074 (settings save must work), PBI-075 (description field in schema)
- Must merge before: PBI-080

#### Context
Read: `src/renderer/components/SettingsPanel.svelte:59-83` — current settings body
Read: `src/shared/types.ts` — `PlanFile.description` (after PBI-075)

#### Verification
- [ ] Settings panel shows a "Description" textarea below the project name
- [ ] Textarea is pre-filled with `plan.description` if it exists, empty otherwise
- [ ] Saving with text sets `description` on the plan and persists to disk
- [ ] Saving with empty textarea omits `description` from the plan (does not save empty string)
- [ ] Round-trip safety: unknown fields preserved
- [ ] Svelte 5 runes syntax, scoped styles
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
None.

---

### PBI-077: Task detail panel — basic fields (title, done, ID, state, parent)

#### Directive
Create a new `TaskDetailPanel.svelte` component that slides in from the right (similar to SettingsPanel) when a task is clicked. The panel shows all basic task fields:

- **Title** — editable text input
- **Done** — toggle checkbox
- **ID** — read-only display
- **State** — editable text input (for `state: "in_progress"` etc.)
- **Parent** — editable text input

Changes are saved when the user clicks "Save" or presses Enter. The panel replaces the current read-only detail panel in `Graph.svelte` and the implicit inline editing in `TaskCard.svelte` as the primary editing surface. TaskCard's double-click/F2 inline editing remains as a shortcut.

**Scope:**
- `src/renderer/components/TaskDetailPanel.svelte` (new component)
- `src/renderer/App.svelte` (add detail panel state, wire open/save/close)
- `src/renderer/components/TaskCard.svelte` (add click handler to open detail panel)

#### Dependencies
- Blocked by: PBI-074 (settings save pattern established)
- Must merge before: PBI-078, PBI-079

#### Context
Read: `src/renderer/components/SettingsPanel.svelte` — established panel pattern (backdrop, slide-in, save/cancel)
Read: `src/renderer/views/Graph.svelte:313-332` — current read-only detail panel (to be superseded)
Read: `src/renderer/App.svelte:34-56` — existing context functions for toggleDone, updateTitle

#### Verification
- [ ] Clicking a TaskCard in any view opens the detail panel
- [ ] Panel shows: Title (editable), Done (checkbox), ID (read-only), State (editable), Parent (editable)
- [ ] Save persists all changed fields to the `.plan` file
- [ ] Cancel/Escape closes without saving
- [ ] Only changed fields are updated (no-op save for unchanged data)
- [ ] Round-trip safety: unknown fields preserved
- [ ] TaskCard inline editing (double-click/F2) still works as a shortcut
- [ ] Graph view's built-in detail panel is replaced by this global one
- [ ] Svelte 5 runes syntax, scoped styles, no CSS frameworks
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm exec tsc --noEmit` passes

#### Refinement Protocol
If the detail panel needs to coexist with the settings panel (both open simultaneously), design them as mutually exclusive (opening one closes the other).

---

### PBI-078: Task detail panel — dependency editing (needs array with cycle detection)

#### Directive
Extend `TaskDetailPanel.svelte` to display and edit the task's `needs` array. Show current dependencies as removable chips. Add an input field with autocomplete suggesting valid task IDs (all tasks in the plan except the current task). When adding a dependency, run cycle detection via `detectCycles()` from `dag.ts` — if the new dependency would create a cycle, reject it with an inline error message.

**Scope:**
- `src/renderer/components/TaskDetailPanel.svelte` (add dependency editing section)
- `src/shared/dag.ts` (export a `wouldCreateCycle` helper if needed)
- Tests for cycle rejection

#### Dependencies
- Blocked by: PBI-077 (basic detail panel must exist)
- Must merge before: PBI-080

#### Context
Read: `src/shared/dag.ts:47-59` — `detectCycles()` function
Read: `src/shared/dag.ts:21-39` — `buildDAG()` function
Read: `src/shared/types.ts:27-35` — `Task.needs` field

#### Verification
- [ ] Current dependencies shown as removable chips in the detail panel
- [ ] Clicking "×" on a chip removes the dependency and saves
- [ ] Autocomplete input suggests valid task IDs (excludes self)
- [ ] Adding a dependency that would create a cycle shows inline error and is rejected
- [ ] Adding a valid dependency saves to the `.plan` file
- [ ] Dependency changes trigger Kanban/Gantt/Graph view updates
- [ ] Round-trip safety: other task fields and unknown fields preserved
- [ ] `pnpm exec svelte-check` passes
- [ ] `pnpm test -- --run` passes (cycle detection tests)

#### Refinement Protocol
If editing typed dependencies (`needs_fs`, `needs_ss`, etc.) is desired, defer to a follow-up PBI. This PBI handles only the default `needs` (FS) array.

---

### PBI-079: Task detail panel — date fields (start, due, duration)

#### Directive
Extend `TaskDetailPanel.svelte` to display and edit the optional date fields: `start` (ISO 8601 date), `due` (ISO 8601 date), and `duration` (informational string like "3d", "1w"). Use native `<input type="date">` for start/due. Use a text input for duration. Validate formats via Zod schemas before saving.

When dates are changed and saved, the Gantt view's time axis (PBI-067 from v0.3.0) should update to reflect the new dates.

**Scope:**
- `src/renderer/components/TaskDetailPanel.svelte` (add date/duration fields section)
- Tests for date field editing

#### Dependencies
- Blocked by: PBI-077 (basic detail panel must exist)
- Must merge before: PBI-080

#### Context
Read: `src/shared/types.ts:51-64` — `TaskExtended` with `start`, `due`, `duration` fields
Read: `src/shared/schemas.ts:5-8` — `isoDateString` and `durationString` Zod patterns
Read: `src/renderer/views/Gantt.svelte:39-43` — `hasTimeData` check

#### Verification
- [ ] Detail panel shows Start, Due, and Duration fields when viewing a task
- [ ] Start and Due use `<input type="date">` with ISO 8601 format
- [ ] Duration uses a text input with placeholder showing format (e.g., "3d, 1w")
- [ ] Invalid date formats show validation error (from Zod)
- [ ] Clearing a date field removes it from the task (does not save empty string)
- [ ] Gantt view updates when dates are changed
- [ ] Round-trip safety: unknown fields preserved
- [ ] Svelte 5 runes syntax, scoped styles
- [ ] `pnpm exec svelte-check` passes

#### Refinement Protocol
If date picker UX needs improvement (e.g., relative date shortcuts), defer to a follow-up PBI.

---

## P3 — Dogfood

### PBI-080: v0.4.0 demo .plan file

#### Directive
Update `demo/partial.plan` to v0.4.0. Replace all v0.3.0 PBIs with v0.4.0 PBIs (072–080). Update metadata to reflect v0.4.0. This is a clean iteration plan — no carried-over items from prior versions.

**Scope:**
- `demo/partial.plan` (overwrite with v0.4.0 content only)

#### Dependencies
- Blocked by: PBI-072, PBI-073, PBI-076, PBI-079 (need stable PBI scope)
- Must merge before: None (last PBI in the release)

#### Context
Read: This backlog (`plans/backlog-v0.4.0.md`)

#### Verification
- [ ] Only v0.4.0 PBIs (072–080) are present as tasks
- [ ] No v0.3.0 or earlier items carried over
- [ ] Dependency edges match this backlog's dependency graph
- [ ] Metadata reflects v0.4.0
- [ ] File parses without errors: `pnpm exec tsx src/cli/index.ts validate demo/partial.plan`
- [ ] Round-trip safe (unknown fields in metadata preserved)

#### Refinement Protocol
Update this file as PBIs are completed during the release cycle.

---

## Execution Notes

### Parallelism Opportunities

| Track | PBIs | Isolation |
|-------|------|-----------|
| **Kanban fix** | 072 | `Kanban.svelte` column logic |
| **Theme polish** | 073 | `theme.css`, opacity values in views |
| **Settings bug** | 074 | `SettingsPanel.svelte` |
| **Schema** | 075 | `types.ts`, `schemas.ts` |
| **Settings desc** | 076 | `SettingsPanel.svelte` (after 074+075) |
| **Detail panel** | 077 → 078, 079 | `TaskDetailPanel.svelte` (new), `App.svelte` |
| **Dogfood** | 080 | `demo/partial.plan` |

### Suggested Sprint Sequence

**Sprint 1 (parallel):** PBI-072, PBI-073, PBI-074, PBI-075
**Sprint 2:** PBI-076, PBI-077
**Sprint 3 (parallel):** PBI-078, PBI-079
**Sprint 4:** PBI-080

### Acceptance Gate (v0.4.0 Release Criteria)

- `pnpm check` passes
- `pnpm exec tsc --noEmit` passes
- `pnpm exec svelte-check` passes
- `pnpm test -- --run` passes
- Kanban shows 3 columns by default (no phantom In Progress)
- Colors visibly brighter, done tasks readable in all views
- Settings save persists project name to disk reliably
- Description editable in settings panel
- Clicking a task opens detail panel with all editable fields
- Dependencies editable with cycle rejection
- Date fields editable, Gantt time axis updates
- `demo/partial.plan` loads and renders correctly in all views

### Deferred to v0.5.0

| Item | Reason |
|---------|--------|
| Biome Svelte overrides | Still waiting on upstream support |
| Drag-and-drop Kanban reordering | Complex interaction; detail panel ships first |
| Undo/redo for edits | Requires command pattern architecture |
| Custom statuses in Kanban columns | 3-col default is sufficient for now |
| Typed dependency editing (needs_fs, needs_ss, etc.) | Default `needs` ships first |
| Error toast/notification UI | Defer until more editing surfaces exist |
