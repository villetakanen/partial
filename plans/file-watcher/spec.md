# Feature: File Watcher

## Blueprint

### Context

Partial is a local-first tool where `.plan` files live on disk alongside the project. The file watcher monitors these files for changes and triggers re-parsing, enabling a live feedback loop: the user edits a `.plan` file in any editor, and Partial's views update automatically.

The watcher must handle the realities of file system events — rapid saves, atomic renames, deletions, and editor-specific quirks (temp files, write-rename patterns) — without crashing, duplicating events, or missing changes.

### Architecture

- **Source file:** `src/main/watcher.ts`
- **File watching library:** `chokidar`
- **Runs in:** Electron main process

**API Contract:**

```typescript
/** Start watching a directory for .plan file changes */
function watchDirectory(dirPath: string): PlanWatcher

/** PlanWatcher interface */
interface PlanWatcher {
  /** Emitted when a .plan file is created or modified */
  on(event: 'change', handler: (filePath: string, plan: PlanFile) => void): void
  /** Emitted when a .plan file is deleted */
  on(event: 'delete', handler: (filePath: string) => void): void
  /** Emitted when a .plan file is renamed */
  on(event: 'rename', handler: (oldPath: string, newPath: string) => void): void
  /** Emitted on parse errors (file exists but is invalid YAML) */
  on(event: 'error', handler: (filePath: string, error: ParseError) => void): void
  /** Stop watching and clean up */
  close(): void
}
```

- **Dependencies:** `chokidar`, plan parser (`src/main/parser.ts`)
- **Dependents:** Electron main process (forwards parsed plans to renderer via IPC)

**IPC Contract (main → renderer):**

| Channel | Payload | Trigger |
|---------|---------|---------|
| `plan:updated` | `{ filePath: string, plan: PlanFile }` | File created or modified |
| `plan:deleted` | `{ filePath: string }` | File deleted |
| `plan:error` | `{ filePath: string, error: string }` | Parse failure |

### Anti-Patterns

- **No debouncing** — Editors often trigger multiple rapid write events for a single save. Always debounce (50-100ms) to avoid redundant re-parses.
- **Watching node_modules** — The glob pattern must be scoped to `*.plan` files only. Never recursively watch all files.
- **Blocking the main process** — File reading and parsing must be non-blocking. Use async file reads.
- **Swallowing watcher errors** — File permission errors, disappeared directories, etc. must surface to the user.
- **Re-parsing on own writes** — If Partial itself writes a `.plan` file, the watcher must not trigger a redundant re-parse loop. Use a write-lock or ignore list.

## Contract

### Definition of Done

- [ ] Watches a specified directory for `*.plan` file changes (create, modify, delete, rename)
- [ ] Debounces rapid successive events (configurable, default 100ms)
- [ ] Parses changed files using `parsePlan` and emits structured events
- [ ] Emits `error` events for invalid YAML with file path context
- [ ] Handles atomic rename patterns (write to temp, rename to target)
- [ ] Ignores non-`.plan` files and hidden files/directories
- [ ] Provides a `close()` method that cleans up all watchers and timers
- [ ] Forwards events to renderer via Electron IPC
- [ ] Does not trigger re-parse loops when Partial itself writes a file
- [ ] All exported functions have JSDoc comments

### Regression Guardrails

- Watcher must never crash the Electron main process on file system errors
- Events must be delivered in order per file (no out-of-order change/delete)
- Watcher must handle the watched directory being deleted/moved
- Memory: watcher must not accumulate unbounded event listeners

### Scenarios

**Scenario: File modified externally**
- Given: A `.plan` file is being watched
- When: The user saves the file in VS Code
- Then: A `change` event fires with the parsed `PlanFile` within 200ms

**Scenario: Rapid saves debounced**
- Given: A `.plan` file is being watched with 100ms debounce
- When: The file is saved 5 times in 50ms
- Then: Only one `change` event fires (for the final state)

**Scenario: Invalid YAML saved**
- Given: A valid `.plan` file is being watched
- When: The user introduces a YAML syntax error and saves
- Then: An `error` event fires with the file path and parse error details

**Scenario: File deleted**
- Given: A `.plan` file is being watched
- When: The file is deleted from disk
- Then: A `delete` event fires with the file path

**Scenario: New .plan file created**
- Given: A directory is being watched
- When: A new `project.plan` file is created in the directory
- Then: A `change` event fires with the parsed content

**Scenario: Non-plan file ignored**
- Given: A directory is being watched
- When: A `README.md` or `.plan.bak` file is created
- Then: No events fire
