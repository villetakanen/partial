# Feature: List View — Editable Table

## Blueprint

### Context

Gantt, Kanban, and Graph views each show tasks from a different perspective. The List view adds a flat, spreadsheet-style table where every task field is visible and inline-editable. This is ideal for bulk data entry and overview.

### Architecture

- **Source file:** `src/renderer/views/List.svelte` (new)
- **UI framework:** Svelte 5 (runes syntax)
- **Runs in:** Electron renderer process

**Component Contract:**

```typescript
interface ListViewProps {
  plan: PlanFile
  dag: Graph
}
```

**Columns:**
| Column | Editable | Notes |
|--------|----------|-------|
| Done | Checkbox | Toggle via `partial:toggleDone` context |
| ID | Read-only | Click opens detail panel |
| Title | Inline text | Double-click to edit |
| State | Inline text | Double-click to edit |
| Parent | Inline text | Double-click to edit |
| Start | Inline text | Double-click to edit |
| Due | Inline text | Double-click to edit |
| Duration | Inline text | Double-click to edit |
| Needs | Inline text | Comma-separated; double-click to edit |

**Key Design Decisions:**
- Generic `partial:updateTask(taskId, updates)` context using `{ ...t, ...updates }` spread (preserves unknown fields)
- Sort: click header cycles ascending → descending → none
- Tab/Shift+Tab navigates editable cells across rows
- `needs` column: comma-separated text input (MVP; richer tag UI can follow)
- Scoped Svelte styles, sticky header, all colors via CSS vars

**Data Flow:**
- Receives `PlanFile` + `Graph` from App.svelte
- Reads `partial:toggleDone`, `partial:updateTask`, `partial:openDetail` from Svelte context
- Sorted task list via `$derived`

### Anti-Patterns

- **Direct plan mutation** — All edits flow through context functions that trigger save
- **Hardcoded colors** — All colors reference CSS variables
- **Svelte 4 syntax** — No `export let` or `$:` reactive declarations

## Contract

### Definition of Done

- [ ] Table renders all columns with correct headers
- [ ] Done checkbox toggles task completion
- [ ] ID column click opens task detail panel
- [ ] Double-click on editable cells enters edit mode
- [ ] Enter commits edit, Escape cancels
- [ ] Tab/Shift+Tab navigates between editable cells
- [ ] Column header click sorts ascending → descending → none
- [ ] Empty plan shows "No tasks to display"
- [ ] Done tasks have muted styling
- [ ] Needs column displays comma-separated values
- [ ] All colors use CSS variables
- [ ] Tests: rendering, sorting, cell display, empty state
- [ ] `partial:updateTask` context preserves unknown fields via spread

### Scenarios

**Scenario: Tasks displayed in table**
- Given: A plan with 3 tasks
- When: List view renders
- Then: 3 rows with all fields visible

**Scenario: Sort by title**
- Given: Tasks with titles "Zebra", "Alpha", "Middle"
- When: User clicks Title header once
- Then: Tasks sorted alphabetically ascending

**Scenario: Inline edit**
- Given: Task with title "Old Title"
- When: User double-clicks the title cell, types "New Title", presses Enter
- Then: Title updates and plan saves to disk

**Scenario: Empty plan**
- Given: Plan with no tasks
- When: List view renders
- Then: Shows "No tasks to display" placeholder
