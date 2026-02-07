# Feature: CLI (`partial`)

## Blueprint

### Context

The `partial` CLI is a command-line interface for working with `.plan` files outside the Electron desktop app. It enables agents, CI pipelines, and terminal-native users to validate plans, query project status, and inspect the dependency graph without launching a GUI.

The CLI follows Unix conventions: composable commands, piping support, structured output via `--json`, and meaningful exit codes. It is the primary integration point for AI agents working with Partial projects.

### Architecture

- **Source file:** `src/cli/index.ts`
- **Entry point:** Registered as `partial` in `package.json` `bin` field
- **Runs in:** Node.js (no Electron dependency)

**Command Contract:**

```
partial validate [file.plan]    # Validate a .plan file against the schema
partial status [file.plan]      # Show project status summary
partial unblocked [file.plan]   # List tasks with all dependencies satisfied
partial graph [file.plan]       # Output the dependency graph (text or DOT format)
```

**Graph command flags (v0.3.0):**

| Flag | Description |
|------|-------------|
| `--format text` | Human-readable text output (default) |
| `--format dot` | Graphviz DOT format for piping to `dot`, `fdp`, etc. |

**Global flags:**

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON instead of human-readable text |
| `--quiet` | Suppress non-error output |
| `--version` | Print version and exit |
| `--help` | Print usage and exit |

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | User error (invalid file, schema violation, missing argument) |
| `2` | System error (file not found, permission denied, unexpected crash) |

- **Dependencies:** Plan parser, DAG engine, `process.stdin`/`process.stdout`
- **Dependents:** CI pipelines, AI agents, terminal users

### Anti-Patterns

- **Importing Electron modules** — The CLI must run in plain Node.js. Never import from `electron` or renderer-specific code.
- **Writing to stderr for non-errors** — Use stdout for all normal output, stderr only for errors and `--quiet` mode warnings.
- **Non-zero exit on success** — Every successful command must exit `0`. Validation warnings are still exit `0` unless `--strict` flag is added later.
- **Unstructured JSON output** — The `--json` output must have a stable, documented schema. Don't dump internal objects directly.
- **Ignoring stdin** — Commands that accept a file path should also accept piped input via stdin when no file argument is provided.

## Contract

### Definition of Done

- [ ] `partial validate` checks a `.plan` file and reports schema errors
- [ ] `partial status` displays task counts by state (done, ready, blocked)
- [ ] `partial unblocked` lists tasks whose dependencies are all satisfied
- [ ] `partial graph` outputs the dependency graph in human-readable text format
- [ ] `partial graph --format dot` outputs valid Graphviz DOT syntax with node labels and directed edges (v0.3.0)
- [ ] DOT output styles done tasks differently (e.g., filled gray) (v0.3.0)
- [ ] All commands support `--json` flag for structured output
- [ ] All commands accept file path as argument or read from stdin
- [ ] Exit codes follow the documented convention (0, 1, 2)
- [ ] `--help` prints usage for each command
- [ ] `--version` prints the version from `package.json`
- [ ] No dependency on Electron (runs in plain Node.js)
- [ ] All exported functions have JSDoc comments

### Regression Guardrails

- CLI must never exit `0` when validation finds errors
- JSON output schema must not change without a version bump
- CLI must not import any Electron or renderer modules
- stdin piping must work for all commands that accept file input
- Exit code `2` must only occur for system-level failures, never for user input errors

### Scenarios

**Scenario: Validate a correct file**
- Given: A valid `.plan` file at `project.plan`
- When: `partial validate project.plan`
- Then: Prints "Valid" to stdout, exits with code `0`

**Scenario: Validate an invalid file**
- Given: A `.plan` file missing the required `project` field
- When: `partial validate project.plan`
- Then: Prints validation errors to stdout, exits with code `1`

**Scenario: Status summary**
- Given: A plan with 2 done tasks, 3 ready, 1 blocked
- When: `partial status project.plan`
- Then: Prints summary showing counts per state

**Scenario: JSON output**
- Given: A valid `.plan` file
- When: `partial status project.plan --json`
- Then: Prints a JSON object with `{ done: 2, ready: 3, blocked: 1 }` structure

**Scenario: Unblocked tasks**
- Given: A plan where tasks B and C have all dependencies done
- When: `partial unblocked project.plan`
- Then: Prints task IDs "B" and "C"

**Scenario: Piped input**
- Given: A valid `.plan` file
- When: `cat project.plan | partial validate`
- Then: Reads from stdin, validates, prints result, exits `0`

**Scenario: Missing file**
- Given: No file at `nonexistent.plan`
- When: `partial validate nonexistent.plan`
- Then: Prints error "File not found: nonexistent.plan" to stderr, exits `2`

**Scenario: Graph output**
- Given: A plan with A → B → C
- When: `partial graph project.plan`
- Then: Prints a text representation showing the dependency edges

**Scenario: Graph DOT export (v0.3.0)**
- Given: A plan with tasks A → B → C where A is `done: true`
- When: `partial graph project.plan --format dot`
- Then: Outputs valid DOT syntax with `digraph`, nodes labeled with task titles, directed edges, and done tasks styled (e.g., `fillcolor=gray`)

**Scenario: DOT piped to Graphviz (v0.3.0)**
- Given: A valid `.plan` file
- When: `partial graph project.plan --format dot | dot -Tpng -o graph.png`
- Then: Produces a valid PNG image of the dependency graph
