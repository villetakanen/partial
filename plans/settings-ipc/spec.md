# Feature: Settings IPC Channel

## Blueprint

### Context

The renderer process needs to read and write app settings (e.g., font size). The `AppSettings` type lived only in `src/main/store.ts` and was not accessible to shared code. This PBI moves the type to `@shared/ipc` and adds `SETTINGS_GET`/`SETTINGS_SET` IPC channels.

### Architecture

- **Shared type:** `AppSettings` in `src/shared/ipc.ts`
- **IPC channels:** `settings:get` (renderer → main, returns `AppSettings`), `settings:set` (renderer → main, merges partial settings)
- **Main process:** `src/main/index.ts` registers `ipcMain.handle` for both channels
- **Preload:** `src/preload/index.ts` exposes `getSettings()`/`setSettings()` via contextBridge
- **Store:** `src/main/store.ts` imports `AppSettings` from shared; improved error logging

**Data Flow:**
```
Renderer → preload.getSettings() → ipcMain.handle('settings:get') → store.readSettings()
Renderer → preload.setSettings(partial) → ipcMain.handle('settings:set') → store.writeSettings(partial)
```

### Anti-Patterns

- **Duplicating the type** — `AppSettings` must be defined once in `@shared/ipc`, not separately in main and renderer.
- **Direct file access from renderer** — Settings must flow through IPC, not direct `fs` calls.

## Contract

### Definition of Done

- [ ] `AppSettings` interface in `src/shared/ipc.ts` with `fontSize` field
- [ ] `SETTINGS_GET` and `SETTINGS_SET` channels added to `IPC_CHANNELS`
- [ ] `PartialAPI` extended with `getSettings()` and `setSettings()`
- [ ] `src/main/store.ts` imports `AppSettings` from shared
- [ ] IPC handlers registered in `src/main/index.ts`
- [ ] Preload exposes both methods
- [ ] All tests pass

### Scenarios

**Scenario: Read settings from renderer**
- Given: Settings file contains `{ "fontSize": 16 }`
- When: Renderer calls `api.getSettings()`
- Then: Returns `{ fontSize: 16, ... }`

**Scenario: Write settings from renderer**
- Given: Existing settings on disk
- When: Renderer calls `api.setSettings({ fontSize: 12 })`
- Then: Settings file is updated with merged values
