# ADR-001: Task Date and Duration Fields for Gantt Time Axis

## Status

**Proposed** — open for review before implementation in v0.3.0 or v0.4.0.

## Context

Partial's Gantt view currently positions task bars by **topological sort index**
using `d3.scaleLinear` (see [v0.1.0 Finding 5](../../docs/0.1.0-findings.md)).
This works well for showing dependency order but does not convey calendar time,
which users of traditional Gantt charts expect.

The `.plan` schema (v1.0.0) has no date or duration fields on `Task`. Adding
optional temporal fields would let the renderer switch from unit-position mode to
a true `d3.scaleTime` axis while keeping backwards compatibility with plans that
omit dates.

### Design goals

1. **Optional** — plans without dates must continue to render correctly.
2. **Round-trip safe** — the fields must survive parse → modify → write cycles
   without data loss, including unknown sub-fields.
3. **Human-writable** — `.plan` files are edited by hand and by AI agents; the
   date format must be unambiguous and easy to type.
4. **Extensible** — leave room for future scheduling features (milestones,
   recurring tasks, time-zone-aware timestamps).

## Options Considered

### Option A: ISO 8601 date strings (`start`, `due`)

```yaml
- id: pbi-067
  title: Implement Gantt time axis with date fields
  start: 2026-02-10
  due: 2026-02-14
```

| Aspect | Assessment |
|--------|------------|
| Clarity | Unambiguous, internationally understood |
| Tooling | Native YAML date type; parsed as `Date` by most libraries |
| Human-writability | Straightforward `YYYY-MM-DD` |
| Gantt mapping | Direct: `start` → bar left edge, `due` → bar right edge |
| Round-trip safety | Strings survive as-is; YAML `!!timestamp` requires care |
| Extensibility | Can add `T` time component later for hour-level precision |
| Drawback | Requires absolute calendar knowledge at authoring time |

### Option B: Relative duration (`duration`) with optional anchor (`start`)

```yaml
- id: pbi-067
  title: Implement Gantt time axis with date fields
  duration: 3d
  start: 2026-02-10   # optional anchor
```

| Aspect | Assessment |
|--------|------------|
| Clarity | Duration alone is relative; needs an anchor to place on calendar |
| Tooling | Custom parse required (`3d`, `1w`, `2h`) — not a YAML native |
| Human-writability | Compact and intuitive for estimates |
| Gantt mapping | Requires a scheduling algorithm to resolve start dates from DAG |
| Round-trip safety | String field; survives round-trip trivially |
| Extensibility | Natural fit for auto-scheduling / resource levelling |
| Drawback | Adds complexity: scheduling engine needed to compute positions |

### Option C: Sprint / iteration-based (`sprint`)

```yaml
- id: pbi-067
  title: Implement Gantt time axis with date fields
  sprint: 3
```

| Aspect | Assessment |
|--------|------------|
| Clarity | Simple ordinal; meaning depends on external sprint definitions |
| Tooling | Integer field, trivial to parse |
| Human-writability | Very easy |
| Gantt mapping | Maps to fixed-width columns, not true calendar time |
| Round-trip safety | Trivial |
| Extensibility | Limited — no date precision, no partial-sprint placement |
| Drawback | Does not produce a time-axis Gantt; essentially another ordinal view |

## Decision

**Option A (ISO 8601 date strings)** is recommended as the primary approach.

Add three optional fields to `Task`:

| Field | Type | Description |
|-------|------|-------------|
| `start` | `string` (ISO 8601 date) | Planned start date (`YYYY-MM-DD`) |
| `due` | `string` (ISO 8601 date) | Planned end / due date (`YYYY-MM-DD`) |
| `duration` | `string` | Estimated duration (e.g. `3d`, `1w`) — informational, not used for positioning in v1 |

Rules:

1. All three fields are **optional**. When omitted, the Gantt view falls back to
   the current topological-order layout for that task.
2. When `start` and `due` are both present, the bar spans the calendar range.
3. When only `start` is present, a default 1-day bar width is used.
4. `duration` is stored as a human-readable string for estimation purposes.
   A future scheduling engine (Option B) may consume it, but the v1
   implementation does not auto-schedule from durations.
5. Date strings are stored as **plain YAML strings** (quoted or unquoted) and
   parsed with `new Date()` at render time. The YAML `!!timestamp` tag is
   accepted but not required.

### Zod schema sketch

```typescript
// Additions to TaskSchema (not yet implemented)
import { z } from 'zod'

const isoDateString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Expected ISO 8601 date (YYYY-MM-DD)',
)

const durationString = z.string().regex(
  /^\d+[dhwm]$/,
  'Expected duration like 3d, 1w, 2h, 1m',
)

const TaskDateFields = z.object({
  start: isoDateString.optional(),
  due: isoDateString.optional(),
  duration: durationString.optional(),
}).passthrough()   // ← preserves unknown fields
```

The existing `Task` interface already has `[key: string]: unknown`, so these
fields are already legal in the schema today — they are simply ignored by the
renderer. The Zod refinement adds **validation** when present.

### Gantt view transition

When at least one task has a `start` or `due` field:

1. Switch x-axis from `d3.scaleLinear` (ordinal index) to `d3.scaleTime`.
2. Tasks **with** dates are placed at their calendar positions.
3. Tasks **without** dates remain ordered by topological sort and placed in
   available gaps or appended after dated tasks.
4. The critical path highlight continues to work — it is DAG-based, not
   date-based.

## Consequences

### Positive

- Enables a true calendar Gantt chart without breaking existing `.plan` files.
- Human-readable ISO dates are easy for both manual editing and AI generation.
- Round-trip safety is maintained: the index signature on `Task` already allows
  any extra string keys, and `z.passthrough()` ensures Zod does not strip them.
- The `duration` field provides a migration path toward auto-scheduling later.

### Negative

- Mixed-mode rendering (some tasks dated, others not) adds UI complexity.
- Date validation is needed at parse time to provide useful error messages.
- YAML auto-typing of unquoted dates to `!!timestamp` could cause subtle issues
  if the YAML library coerces to `Date` objects; parser must normalize to string.

### Risks

- If most tasks lack dates, the "gaps" heuristic for undated tasks may produce a
  confusing layout. Mitigation: fall back entirely to ordinal mode if fewer than
  50% of tasks have dates.
- Duration notation (`3d`) is not standardized; could conflict with future ISO
  8601 duration support (`P3D`). Mitigation: accept both formats in a future
  version, prefer the shorter form for human authoring.
