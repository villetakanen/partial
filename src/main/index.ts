import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OpenDirectoryPayload, PlanSavePayload } from '@shared/ipc'
import { IPC_CHANNELS } from '@shared/ipc'
import { app, BrowserWindow, ipcMain } from 'electron'
import { stringifyPlan } from './parser'
import type { PlanWatcher } from './watcher'
import { watchDirectory } from './watcher'

/** Currently active file watcher (one directory at a time). */
let activeWatcher: PlanWatcher | null = null

/**
 * Paths written by the app itself via `plan:save`.
 * Used to suppress the watcher's own change event after a self-write,
 * preventing double-parsing.
 */
const selfWritePaths = new Set<string>()

/**
 * Create the main application window with secure web preferences.
 */
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, '../preload/index.mjs'),
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/**
 * Send an IPC message to all open renderer windows.
 */
function sendToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

/**
 * Start watching a directory and wire watcher events to IPC channels.
 */
async function startWatching(dirPath: string): Promise<void> {
  if (activeWatcher) {
    await activeWatcher.close()
    activeWatcher = null
  }

  const watcher = watchDirectory(dirPath)

  watcher.on('change', (filePath, plan) => {
    if (selfWritePaths.has(filePath)) {
      selfWritePaths.delete(filePath)
      return
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath, plan })
  })

  watcher.on('delete', (filePath) => {
    selfWritePaths.delete(filePath)
    sendToAllWindows(IPC_CHANNELS.PLAN_DELETED, { filePath })
  })

  watcher.on('error', (filePath, error) => {
    if (selfWritePaths.has(filePath)) {
      selfWritePaths.delete(filePath)
      return
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_ERROR, {
      filePath,
      error: error.message,
    })
  })

  activeWatcher = watcher
  await watcher.ready
}

/**
 * Register IPC handlers for renderer → main communication.
 */
function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_DIRECTORY, async (_event, payload: OpenDirectoryPayload) => {
    await startWatching(payload.dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.SAVE, async (_event, payload: PlanSavePayload) => {
    const content = stringifyPlan(payload.plan)
    selfWritePaths.add(payload.filePath)
    await writeFile(payload.filePath, content, 'utf-8')
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Windows/Linux: quit when all windows are closed
// macOS: keep running (standard macOS behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up watcher on quit
app.on('will-quit', async () => {
  if (activeWatcher) {
    await activeWatcher.close()
    activeWatcher = null
  }
})
