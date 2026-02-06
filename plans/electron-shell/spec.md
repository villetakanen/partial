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
| renderer → main | `plan:open-directory` | `{ dirPath: string }` | User selects project directory |
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
- [ ] IPC channels are registered for all documented channels (plan:updated, plan:deleted, plan:error, plan:open-directory, plan:save)
- [ ] `contextIsolation: true` and `nodeIntegration: false` in web preferences
- [ ] Preload script exposes a typed API for renderer-to-main communication
- [ ] Application handles lifecycle events (ready, window-all-closed, activate for macOS)
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

**Scenario: Directory selection**
- Given: The application is running with no project loaded
- When: The user selects a project directory via the UI
- Then: `plan:open-directory` IPC is sent to main, watcher starts on the directory, existing `.plan` files are parsed and sent to renderer

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

**Scenario: macOS lifecycle**
- Given: The app is running on macOS
- When: All windows are closed
- Then: The app remains running (dock icon active); clicking the dock icon recreates the window

**Scenario: Save from UI**
- Given: A plan is loaded in the renderer
- When: A task is modified in the UI and the user saves
- Then: `plan:save` IPC sends the updated `PlanFile` to main, which writes it to disk; the watcher ignores its own write
