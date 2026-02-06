# Feature: Plan Parser

## Blueprint

### Context

The plan parser is the foundational engine of Partial. It converts `.plan` files (YAML) into typed `PlanFile` objects and back again. Every other feature — DAG construction, views, CLI — depends on the parser producing correct, lossless output.

The single most critical invariant: **round-trip safety**. Any field present in a `.plan` file must survive a parse-then-stringify cycle, even if the parser does not recognize it. This enables forward compatibility — older versions of Partial can safely handle files created by newer versions without data loss.

### Architecture

- **Source file:** `src/main/parser.ts`
- **Type definitions:** `src/shared/types.ts`
- **Validation schemas:** Zod schemas co-located with types in `src/shared/`
- **YAML library:** `yaml` package (not `js-yaml`)

**API Contract:**

```typescript
/** Parse raw YAML string into a validated PlanFile */
function parsePlan(content: string): PlanFile

/** Serialize a PlanFile back to YAML, preserving field order and unknown fields */
function stringifyPlan(plan: PlanFile): string

/** Validate a PlanFile against the Zod schema, returning typed errors */
function validatePlan(data: unknown): ValidationResult<PlanFile>
```

- **Data Models:** `PlanFile`, `Task`, `TaskExtended`, `DependencyType` (see `src/shared/types.ts`)
- **Dependencies:** `yaml` (YAML parsing), `zod` (schema validation)
- **Dependents:** DAG engine, file watcher, CLI, all views (via IPC)

### Anti-Patterns

- **Destructure-and-reconstruct** — Never extract known fields and rebuild the object. This drops unknown fields. Always use spread: `{ ...planData, tasks: processedTasks }`.
- **Casting without validation** — Never use `as PlanFile` on raw YAML output. Always validate through Zod first, then narrow.
- **Swallowing parse errors** — YAML syntax errors must surface to the user with line/column information. Never return a default empty plan on parse failure.
- **Mutating input** — `parsePlan` must not mutate the original YAML string. `stringifyPlan` must not mutate the input `PlanFile` object.

## Contract

### Definition of Done

- [ ] `parsePlan` accepts valid `.plan` YAML and returns a typed `PlanFile`
- [ ] `stringifyPlan` serializes a `PlanFile` back to valid YAML
- [ ] Unknown fields at both root and task level survive a full round-trip
- [ ] Zod validation rejects malformed input with actionable error messages (line/column when available)
- [ ] Default values applied: `version` defaults to `"1.0.0"`, `tasks` defaults to `[]`, `task.done` defaults to `false`
- [ ] All four dependency types (`fs`, `ss`, `ff`, `sf`) are parsed from `needs_*` fields
- [ ] Parser handles empty files gracefully (returns valid empty PlanFile)
- [ ] All exported functions have JSDoc comments
- [ ] Test coverage for parser module >= 90%

### Regression Guardrails

- Round-trip safety must never break — this is the parser's core contract
- Zod schemas must stay in sync with TypeScript interfaces in `types.ts`
- YAML indentation and field ordering must be stable across stringify calls
- No implicit type coercion (e.g., YAML `on` → boolean `true`)

### Scenarios

**Scenario: Basic round-trip**
- Given: A `.plan` file with `version`, `project`, and three tasks
- When: Parsed with `parsePlan` then serialized with `stringifyPlan`
- Then: The output YAML is semantically identical to the input

**Scenario: Unknown fields preserved**
- Given: A `.plan` file containing `custom_metadata: { author: "alice" }` at root level and `priority: high` on a task
- When: Parsed and then stringified
- Then: Both `custom_metadata` and `priority` fields appear in the output unchanged

**Scenario: Default values applied**
- Given: A `.plan` file where tasks omit the `done` field
- When: Parsed with `parsePlan`
- Then: Each task's `done` property is `false`

**Scenario: Invalid YAML**
- Given: A string containing malformed YAML (unclosed quotes, bad indentation)
- When: Passed to `parsePlan`
- Then: A typed error is thrown with line/column information, not a generic crash

**Scenario: Empty file**
- Given: An empty string or whitespace-only string
- When: Passed to `parsePlan`
- Then: Returns a `PlanFile` with `version: "1.0.0"`, `project: ""`, `tasks: []`

**Scenario: Extended dependency types**
- Given: A task with `needs_ss: ["task-a"]` and `needs_ff: ["task-b"]`
- When: Parsed with `parsePlan`
- Then: The `needs_ss` and `needs_ff` arrays are present and correctly typed on the task object
