# Feature: Electron Shell

## Blueprint

### Context

The Electron shell is the desktop application container that hosts Partial's Svelte UI. It manages the application lifecycle, creates the browser window, sets up IPC channels between the main and renderer processes, and orchestrates the file watcher and parser subsystems.

This is the integration layer — it doesn't implement business logic itself, but wires together the parser, watcher, DAG engine, and Svelte renderer into a running desktop application.

### Architecture

- **Source file:** `src/main/index.ts`
- **Renderer entry:** `src/renderer/main.ts` + `src/renderer/index.html`
- **Root component:** `src/renderer/App.svelte`
- **Build tool:** electron-vite (Vite-based build for Electron)
- **Packaging:** electron-builder

**Main Process Responsibilities:**
1. Create `BrowserWindow` with appropriate web preferences
2. Initialize the file watcher on the project directory
3. Set up IPC handlers for main ↔ renderer communication
4. Handle application lifecycle events (ready, window-all-closed, activate)

**IPC Channel Contract:**

| Direction | Channel | Payload | Purpose |
|-----------|---------|---------|---------|
| main → renderer | `plan:updated` | `{ filePath: string, plan: PlanFile }` | Plan file changed on disk |
| main → renderer | `plan:deleted` | `{ filePath: string }` | Plan file deleted |
| main → renderer | `plan:error` | `{ filePath: string, error: string }` | Parse error |
| renderer → main | `plan:open-file` | `{ filePath: string }` | User opens a .plan file by path |
| renderer → main | `plan:show-open-dialog` | (none) | Show native file picker for .plan files |
| renderer → main | `plan:save` | `{ filePath: string, plan: PlanFile }` | User saves changes from UI |

**Renderer Architecture:**
- `App.svelte` is the root component managing view state
- View switching between Gantt, Kanban, and Graph views
- Receives plan data via IPC, computes DAG locally in renderer
- Task interactions dispatch save events back to main process

- **Dependencies:** Electron, electron-vite, file watcher, parser
- **Dependents:** All views (Gantt, Kanban, Graph), TaskCard component

### Anti-Patterns

- **Business logic in main process** — The main process is a thin shell. DAG computation, view logic, and state management belong in the renderer or shared modules.
- **Synchronous IPC** — Use `ipcRenderer.invoke` / `ipcMain.handle` (async) instead of `ipcRenderer.sendSync`. Synchronous IPC blocks the renderer.
- **nodeIntegration: true** — Keep `nodeIntegration: false` and `contextIsolation: true` for security. Expose only specific APIs via `preload.ts`.
- **Direct file system access from renderer** — All file operations go through IPC to the main process. The renderer never imports `fs` or `path`.
- **Svelte 4 syntax in App.svelte** — Use `$state()` for view state, `$derived()` for computed plan data. No `export let` or `$:`.

## Contract

### Definition of Done

- [ ] Application starts and shows a `BrowserWindow` loading the Svelte renderer
- [ ] Main process initializes file watcher on a configurable project directory
- [ ] IPC channels are registered for all documented channels (plan:updated, plan:deleted, plan:error, plan:open-file, plan:show-open-dialog, plan:save)
- [ ] `contextIsolation: true` and `nodeIntegration: false` in web preferences
- [ ] Preload script exposes a typed API for renderer-to-main communication
- [ ] Application handles lifecycle events (ready, window-all-closed → quit on all platforms)
- [ ] Native Electron menu with File > Open (Cmd/Ctrl+O) for .plan files
- [ ] Welcome screen shown when no plan is loaded
- [ ] Last-opened file path persisted and auto-loaded on relaunch
- [ ] `App.svelte` supports view switching between Gantt, Kanban, and Graph
- [ ] Renderer receives plan updates via IPC and computes DAG for views
- [ ] `pnpm dev` starts Electron with Vite HMR for the renderer
- [ ] `pnpm build` produces a distributable application
- [ ] electron-builder config produces platform-specific packages (dmg, exe, AppImage)

### Regression Guardrails

- `contextIsolation` must never be set to `false`
- `nodeIntegration` must never be set to `true`
- Main process must not crash on watcher errors (graceful error forwarding)
- Renderer must not directly import Node.js modules (`fs`, `path`, `child_process`)
- IPC channel names must match between main and renderer (type-checked if possible)
- Application must not leave zombie processes on quit

### Scenarios

**Scenario: Application startup**
- Given: The application is launched
- When: Electron's `ready` event fires
- Then: A `BrowserWindow` is created, the Svelte app loads, and the default view is shown

**Scenario: File selection**
- Given: The application is running with no plan loaded
- When: The user selects a .plan file via the native file picker
- Then: The file is read, parsed, and sent to the renderer via `plan:updated`; the file's parent directory is watched for changes

**Scenario: Live file update**
- Given: A project directory is being watched
- When: A `.plan` file is modified externally
- Then: The watcher detects the change, parser produces a `PlanFile`, `plan:updated` IPC delivers it to the renderer, views update

**Scenario: Parse error forwarded**
- Given: A `.plan` file is being watched
- When: The file is saved with invalid YAML
- Then: `plan:error` IPC delivers the error to the renderer, which displays an error notification

**Scenario: View switching**
- Given: The Gantt view is currently displayed
- When: The user clicks the Kanban tab
- Then: `App.svelte` switches to render the Kanban view with the same plan data

**Scenario: Window close quits app (all platforms)**
- Given: The app is running on any platform (macOS, Windows, Linux)
- When: All windows are closed
- Then: The app quits entirely (no dock icon, no background process)
- Note: Changed in v0.2.0 (was macOS keep-alive). Partial is a single-window app where dock persistence confuses users.

**Scenario: Save from UI**
- Given: A plan is loaded in the renderer
- When: A task is modified in the UI and the user saves
- Then: `plan:save` IPC sends the updated `PlanFile` to main, which writes it to disk; the watcher ignores its own write

**Scenario: File open via native menu (v0.2.0)**
- Given: The app is running with no plan loaded
- When: The user selects File > Open (or presses Cmd/Ctrl+O)
- Then: A native file picker dialog opens filtered to .plan files; selecting a file reads, parses, and displays it; canceling does nothing

**Scenario: Welcome screen (v0.2.0)**
- Given: The app launches with no previously opened file
- When: The renderer loads
- Then: A Welcome screen is shown with project name and an "Open Plan File" button
- When: The user clicks "Open Plan File" or uses the menu
- Then: After a file is selected and parsed, the Welcome screen is replaced by the active view

**Scenario: Last-opened file persistence (v0.2.0)**
- Given: The user has previously opened a .plan file
- When: The app is relaunched
- Then: The last-opened file is automatically loaded; if the path no longer exists, the Welcome screen is shown
