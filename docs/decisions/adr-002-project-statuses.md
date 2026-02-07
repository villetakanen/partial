# ADR-002: Project-level Statuses Configuration

## Status

**Proposed** — open for review before implementation in v0.3.0 or v0.4.0.

## Context

Partial's Kanban view renders four hardcoded columns: **Blocked**, **Ready**,
**In Progress**, and **Done**. Column assignment is derived from a combination
of `done: true/false`, the DAG's unblocked-task calculation, and an optional
`state: "in_progress"` extended field on tasks.

This was identified as a UX mismatch in
[v0.1.0 Finding HF-3](../../docs/0.1.0-findings.md): the default `.plan`
format only expresses two states (`done: true` / `done: false`), so the
"In Progress" column is always empty unless users manually add
`state: in_progress` to their tasks. The "Blocked" column only populates when
tasks have unfinished dependencies.

For simple plans with no dependencies, all not-done tasks land in "Ready" and
all done tasks land in "Done" — two of four columns sit permanently empty.

### Design goals

1. **User-configurable** — project authors should be able to define their own
   workflow columns (e.g. "Backlog", "In Review", "QA", "Deployed").
2. **Backward compatible** — existing `.plan` files with no `statuses` config
   must continue to work with the current 4-column default.
3. **Round-trip safe** — the `statuses` configuration must survive
   parse → modify → write cycles without data loss.
4. **DAG-aware** — "Blocked" status should remain derived from the DAG, not
   manually assigned. User-defined statuses augment, not replace, the
   dependency-based logic.
5. **Human-writable** — the configuration must be easy to author by hand in
   YAML.

## Options Considered

### Option A: Simple ordered list of status names

```yaml
version: "1.0.0"
project: My Project
statuses:
  - backlog
  - ready
  - in_progress
  - in_review
  - done
tasks:
  - id: task-1
    title: Implement feature
    state: in_review
    done: false
```

| Aspect | Assessment |
|--------|------------|
| Simplicity | Very easy to write and understand |
| Column mapping | Each status name becomes a Kanban column |
| Backward compat | When absent, fall back to hardcoded defaults |
| Extensibility | No room for colors, icons, or WIP limits per status |
| DAG integration | "Blocked" must be handled specially (derived, not assigned) |
| Round-trip safety | Simple string array; trivially preserved |
| Drawback | No metadata per status; limited future extensibility |

### Option B: Structured list with metadata per status

```yaml
version: "1.0.0"
project: My Project
statuses:
  - key: backlog
    label: "Backlog"
    color: "#9e9e9e"
  - key: ready
    label: "Ready"
    color: "#42a5f5"
  - key: in_progress
    label: "In Progress"
    color: "#ff9800"
  - key: in_review
    label: "In Review"
    color: "#ab47bc"
  - key: done
    label: "Done"
    color: "#4caf50"
    terminal: true
tasks:
  - id: task-1
    title: Implement feature
    state: in_review
    done: false
```

| Aspect | Assessment |
|--------|------------|
| Simplicity | More verbose but still readable |
| Column mapping | `key` maps to `task.state`; `label` is the display name |
| Backward compat | When absent, fall back to hardcoded defaults |
| Extensibility | Supports colors, icons, WIP limits, `terminal` flag |
| DAG integration | Can mark certain statuses as DAG-derived (e.g. `blocked`) |
| Round-trip safety | Object array with `.passthrough()` preserves unknown fields |
| Drawback | More complex to validate; need to handle missing labels |

### Option C: Map-based configuration (key → config object)

```yaml
version: "1.0.0"
project: My Project
statuses:
  backlog:
    label: "Backlog"
    color: "#9e9e9e"
  ready:
    label: "Ready"
  in_progress:
    label: "In Progress"
  done:
    label: "Done"
    terminal: true
tasks:
  - id: task-1
    title: Implement feature
    state: in_progress
```

| Aspect | Assessment |
|--------|------------|
| Simplicity | Compact for keys; nesting for optional metadata |
| Column mapping | Object keys map to `task.state`; explicit ordering lost |
| Backward compat | When absent, fall back to hardcoded defaults |
| Extensibility | Same as Option B |
| DAG integration | Same as Option B |
| Round-trip safety | YAML maps have stable key order; preserved by `yaml` package |
| Drawback | YAML object key order is technically unspecified; column order relies on insertion order which most parsers respect but is not guaranteed |

## Decision

**Option B (structured list with metadata)** is recommended.

A structured list combines the ordering guarantee of a YAML sequence with the
extensibility of per-status metadata. The `key` field maps directly to the
task's `state` field value, while `label` provides a human-friendly display
name.

### Schema design

Add an optional top-level `statuses` field to `PlanFile`:

```yaml
statuses:
  - key: blocked
    label: "Blocked"
    derived: true          # computed from DAG, not assignable
  - key: backlog
    label: "Backlog"
  - key: ready
    label: "Ready"
    derived: true          # computed from DAG (unblocked, no explicit state)
  - key: in_progress
    label: "In Progress"
  - key: done
    label: "Done"
    terminal: true         # marks task as complete
```

**Key fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | Yes | Maps to `task.state` value |
| `label` | `string` | No | Display name (defaults to capitalized `key`) |
| `color` | `string` | No | CSS color for the column header / card accent |
| `terminal` | `boolean` | No | If true, tasks in this status are considered "done" |
| `derived` | `boolean` | No | If true, status is computed from DAG, not manually set |

**Rules:**

1. The `statuses` field is **optional**. When absent, the renderer falls back
   to the current hardcoded 4-column layout:
   `[blocked (derived), ready (derived), in_progress, done (terminal)]`.
2. Column **order** matches the array order in the `.plan` file.
3. Exactly one status should have `terminal: true`. This replaces the role of
   `done: true` for column assignment. For backward compatibility, `done: true`
   always maps to the terminal status.
4. Statuses with `derived: true` are computed by the DAG engine, not by matching
   `task.state`. The two built-in derived statuses are:
   - **blocked**: task has unfinished dependencies
   - **ready**: task has all dependencies satisfied and no explicit `state`
5. A task's `state` field value is matched against non-derived status `key`
   values. If a task has `state: "in_review"` and a status with
   `key: "in_review"` exists, it appears in that column.
6. Tasks with no `state` and `done: false` whose dependencies are all met
   appear in the first non-derived, non-terminal status (or "ready" if
   derived statuses are present).

### Relationship between `done` and `terminal`

The `done: boolean` field on tasks remains the canonical completion marker for
backward compatibility and DAG calculations. The `terminal` flag on a status
definition tells the Kanban view which column to show done tasks in:

- `done: true` → task appears in the `terminal` status column
- `done: false` + `state: "in_review"` → task appears in the "in_review" column
- `done: false` + no `state` + all deps met → task appears in the "ready"
  column (or first non-derived status)

### Zod schema sketch

```typescript
import { z } from 'zod'

const StatusDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  color: z.string().optional(),
  terminal: z.boolean().optional(),
  derived: z.boolean().optional(),
}).passthrough()   // ← preserves unknown fields

const StatusesSchema = z.array(StatusDefinitionSchema).optional()

// Addition to PlanFileSchema:
// statuses: StatusesSchema
```

The existing `PlanFile` interface already has `[key: string]: unknown`, so the
`statuses` array is already legal in the schema today — it is simply ignored
by the renderer. The Zod refinement adds **validation** when present.

### Example `.plan` snippet

```yaml
version: "1.0.0"
project: Acme Sprint 5
statuses:
  - key: blocked
    label: "Blocked"
    derived: true
    color: "#ef5350"
  - key: backlog
    label: "Backlog"
    color: "#9e9e9e"
  - key: ready
    label: "Ready"
    derived: true
    color: "#42a5f5"
  - key: in_progress
    label: "In Progress"
    color: "#ff9800"
  - key: in_review
    label: "In Review"
    color: "#ab47bc"
  - key: done
    label: "Done"
    terminal: true
    color: "#4caf50"

tasks:
  - id: feat-1
    title: "Implement auth"
    state: in_review
    done: false
    needs:
      - feat-0

  - id: feat-2
    title: "Write tests"
    state: in_progress
    done: false

  - id: feat-0
    title: "Design API"
    done: true
```

In this example:
- `feat-0` → "Done" column (terminal, `done: true`)
- `feat-1` → "In Review" column (`state: in_review`, deps satisfied)
- `feat-2` → "In Progress" column (`state: in_progress`)

## Consequences

### Positive

- Projects can define custom workflow stages that match their actual process.
- The ordered array guarantees consistent column order across renders.
- The `derived` flag preserves the DAG-based "Blocked" and "Ready" logic while
  allowing users to rename or restyle these columns.
- Round-trip safety is maintained: the index signature on `PlanFile` already
  allows any extra keys, and `z.passthrough()` on each status object preserves
  unknown fields per status.
- The `terminal` flag provides a clean migration path from the current
  `done: true/false` binary to richer completion semantics.

### Negative

- The renderer must handle two code paths: default columns (no `statuses`)
  and custom columns (with `statuses`). This adds branching complexity.
- Validation must ensure at least one `terminal` status exists, and that
  `key` values are unique — adding schema-level constraints.
- Users who add a `statuses` block must understand the `derived` vs. manual
  distinction, which adds cognitive load.

### Risks

- If a task has a `state` value that doesn't match any defined status `key`,
  it falls through. Mitigation: show unmatched tasks in a catch-all "Unknown"
  column with a warning badge, and emit a validation warning at parse time.
- Projects with many custom statuses could produce a cramped Kanban view.
  Mitigation: the existing column collapse behavior (from v0.2.0) handles
  empty columns; a future enhancement could add horizontal scrolling for
  wide boards.
- The `derived` concept may confuse users who expect all columns to be
  manually assignable. Mitigation: documentation and tooltip text explaining
  that "Blocked" and "Ready" are computed from task dependencies.
