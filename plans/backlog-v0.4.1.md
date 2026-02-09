# Project Partial — v0.4.1 Product Backlog

> **Theme:** "Save What You Edit" — Fix persistence bugs and missing detail panel affordances.
> **Format:** ASDLC PBI pattern (Directive + Context Pointer + Verification + Refinement)
> **Ordering:** Dependency-resolved; items higher in the list can be started first.
> **Atomicity:** Each PBI produces a single committable, testable increment.
> **Base:** All v0.4.0 PBIs (072–080) are complete. v0.4.1 PBIs start at 081.

---

## Motivation

v0.4.0 shipped the task detail panel and settings improvements, but real usage surfaced three problems:

1. **Settings changes don't persist** — editing the project name or description in the settings panel does not write the changes to the `.plan` file on disk
2. **Task detail edits don't persist** — editing task fields (title, done, state, parent, dependencies, dates) in the detail panel does not write changes to the `.plan` file on disk
3. **Gantt view has no detail panel access** — clicking a task bar in the Gantt view does nothing; the detail panel can only be opened from Kanban and Graph views

---

## Dependency Graph

```
PBI-081 (settings save persist)     <- None
PBI-082 (detail save persist)       <- None
PBI-083 (Gantt detail panel)        <- None
```

All three are independent and can be worked in parallel.

---

## P0 — Bugs

### PBI-081: Settings panel changes do not persist to file

#### Directive
When the user edits the project name or description in the SettingsPanel and clicks Save, the UI updates but the `.plan` file on disk is not updated. The save flow is: `SettingsPanel.onSave()` -> `App.handleSettingsSave()` -> `api.savePlan()` -> preload IPC `plan:save` -> main process `writeFile`. Investigate which step in this chain is failing and fix it.

**Scope:**
- Trace the save path from `SettingsPanel.svelte` through `App.svelte` to `src/preload/index.ts` and `src/main/index.ts`
- Fix the broken link in the chain
- Add or update tests to verify the save round-trip

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `src/renderer/components/SettingsPanel.svelte` — `handleSave()` calls `onSave()`
Read: `src/renderer/App.svelte:164-168` — `handleSettingsSave()` calls `api.savePlan()`
Read: `src/preload/index.ts` — `savePlan` IPC invoke
Read: `src/main/index.ts` — `plan:save` IPC handler, calls `stringifyPlan` + `writeFile`

#### Verification
- [x] Edit project name in settings, click Save -> `.plan` file on disk reflects the new name
- [x] Edit description in settings, click Save -> `.plan` file on disk reflects the new description
- [x] Watcher does not trigger a spurious re-render after own save
- [x] Round-trip safety: unknown fields preserved after save
- [x] `pnpm exec svelte-check` passes
- [x] `pnpm test -- --run` passes

#### Refinement Protocol
If the issue is in the IPC layer (preload or main process), check whether the channel name or payload shape has drifted from the contract in `src/shared/ipc.ts`.

---

### PBI-082: Task detail panel changes do not persist to file

#### Directive
When the user edits task fields in the TaskDetailPanel (title, done, state, parent, dependencies, dates) and clicks Save, the UI updates but the `.plan` file on disk is not updated. The save flow is: `TaskDetailPanel.onSave()` -> `App.handleDetailSave()` -> `api.savePlan()` -> preload IPC -> main process. Investigate which step in this chain is failing and fix it.

This may share the same root cause as PBI-081 (settings save). If fixing PBI-081 also fixes this, mark as resolved with a note.

**Scope:**
- Trace the save path from `TaskDetailPanel.svelte` through `App.svelte` to `src/preload/index.ts` and `src/main/index.ts`
- Fix the broken link in the chain
- Add or update tests to verify the save round-trip

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `src/renderer/components/TaskDetailPanel.svelte:74-101` — `handleSave()` calls `onSave()` then `onClose()`
Read: `src/renderer/App.svelte:171-179` — `handleDetailSave()` calls `api.savePlan()`
Read: `src/preload/index.ts` — `savePlan` IPC invoke
Read: `src/main/index.ts` — `plan:save` IPC handler

#### Verification
- [x] Edit task title in detail panel, click Save -> `.plan` file on disk reflects the new title
- [x] Toggle done checkbox, click Save -> `.plan` file on disk reflects the new done state
- [x] Edit dependencies, click Save -> `.plan` file on disk reflects updated needs array
- [x] Edit start/due/duration, click Save -> `.plan` file on disk reflects the new dates
- [x] Watcher does not trigger a spurious re-render after own save
- [x] Round-trip safety: unknown fields preserved after save
- [x] `pnpm exec svelte-check` passes
- [x] `pnpm test -- --run` passes

#### Refinement Protocol
If PBI-081 and PBI-082 share the same root cause, implement the fix in PBI-081 and mark PBI-082 as resolved by PBI-081's commit. If the causes differ, fix independently.

---

### PBI-083: Gantt view does not open the task detail panel

#### Directive
Clicking a task bar in the Gantt view does nothing. The Kanban view (via TaskCard click) and Graph view (via node click) both open the detail panel, but the Gantt view has no click handler wired to `partial:openDetail`. Add a click handler to Gantt task bars that opens the detail panel for the clicked task.

**Scope:**
- `src/renderer/views/Gantt.svelte` (add click handler on task bars)

#### Dependencies
- Blocked by: None
- Must merge before: None

#### Context
Read: `src/renderer/views/Gantt.svelte` — task bar rendering (look for `.bar` elements and existing click/interaction handlers)
Read: `src/renderer/components/TaskCard.svelte` — `handleCardClick` pattern using `getContext('partial:openDetail')`
Read: `src/renderer/views/Graph.svelte` — `handleNodeClick` pattern using `getContext('partial:openDetail')`

#### Verification
- [x] Clicking a task bar in Gantt view opens the task detail panel
- [x] Clicking the task label in Gantt view also opens the detail panel
- [x] The correct task is shown in the detail panel (not a different task)
- [x] Editing and saving from the panel opened via Gantt works (persists changes)
- [x] Cursor changes to pointer on hover over clickable bars/labels
- [x] Svelte 5 runes syntax, scoped styles
- [x] `pnpm exec svelte-check` passes

#### Refinement Protocol
If the Gantt bars are rendered via D3 (not Svelte DOM), the click handler may need to be attached via D3's `.on('click', ...)` API rather than Svelte's `onclick`. Follow the existing pattern in Graph.svelte for D3 click handling.

---

## Execution Notes

### Parallelism Opportunities

| Track | PBIs | Isolation |
|-------|------|-----------|
| **Settings persist** | 081 | `SettingsPanel.svelte`, IPC chain |
| **Detail persist** | 082 | `TaskDetailPanel.svelte`, IPC chain |
| **Gantt detail** | 083 | `Gantt.svelte` |

All three PBIs are independent and can be worked in parallel. PBI-081 and PBI-082 may share a root cause.

### Acceptance Gate (v0.4.1 Release Criteria)

- `pnpm check` passes
- `pnpm exec tsc --noEmit` passes
- `pnpm exec svelte-check` passes
- `pnpm test -- --run` passes
- Settings save persists project name and description to `.plan` file on disk
- Task detail save persists all editable fields to `.plan` file on disk
- Clicking Gantt task bars opens the detail panel
