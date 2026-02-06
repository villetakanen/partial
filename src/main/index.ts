import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { OpenFilePayload, PlanSavePayload } from '@shared/ipc'
import { IPC_CHANNELS } from '@shared/ipc'
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { parsePlan, stringifyPlan } from './parser'
import { getLastOpenedFile, setLastOpenedFile } from './store'
import type { PlanWatcher } from './watcher'
import { watchDirectory } from './watcher'

/** Currently active file watcher (one directory at a time). */
let activeWatcher: PlanWatcher | null = null

/**
 * SHA-256 hashes of content written by the app via `plan:save`.
 * When the watcher fires, the current file content is hashed and compared
 * against the stored hash. If they match, the event is a self-write echo
 * and is suppressed. If they differ, an external edit occurred between
 * our write and the watcher event, so the change is forwarded.
 */
const selfWriteHashes = new Map<string, string>()

/** Compute a SHA-256 hex digest of the given content. */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

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
 * Open a .plan file: read, parse, send to renderer, and watch for changes.
 * Closes any previously active watcher before starting a new one.
 */
async function openPlanFile(filePath: string): Promise<void> {
  // Read and parse the file immediately
  const content = await readFile(filePath, 'utf-8')
  const plan = parsePlan(content)
  sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath, plan })

  // Persist the path so it can be auto-loaded on next launch
  await setLastOpenedFile(filePath)

  // Watch the file's parent directory for changes to *.plan files
  if (activeWatcher) {
    await activeWatcher.close()
    activeWatcher = null
  }

  const watcher = watchDirectory(dirname(filePath))

  watcher.on('change', async (changedPath, changedPlan) => {
    const expectedHash = selfWriteHashes.get(changedPath)
    if (expectedHash) {
      selfWriteHashes.delete(changedPath)
      try {
        const currentContent = await readFile(changedPath, 'utf-8')
        if (hashContent(currentContent) === expectedHash) return
      } catch {
        // File disappeared between watcher event and read — forward the event
      }
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath: changedPath, plan: changedPlan })
  })

  watcher.on('delete', (deletedPath) => {
    selfWriteHashes.delete(deletedPath)
    sendToAllWindows(IPC_CHANNELS.PLAN_DELETED, { filePath: deletedPath })
  })

  watcher.on('error', async (errorPath, error) => {
    const expectedHash = selfWriteHashes.get(errorPath)
    if (expectedHash) {
      selfWriteHashes.delete(errorPath)
      try {
        const currentContent = await readFile(errorPath, 'utf-8')
        if (hashContent(currentContent) === expectedHash) return
      } catch {
        // File disappeared — forward the error
      }
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_ERROR, {
      filePath: errorPath,
      error: error.message,
    })
  })

  activeWatcher = watcher
  await watcher.ready
}

/**
 * Show a native file picker for .plan files and open the selected file.
 * Does nothing if the user cancels.
 */
async function openFileDialog(): Promise<void> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Open Plan File',
    filters: [{ name: 'Plan Files', extensions: ['plan'] }],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return
  }

  await openPlanFile(result.filePaths[0])
}

/**
 * Build the native application menu with File > Open.
 */
function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openFileDialog()
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * Register IPC handlers for renderer → main communication.
 */
function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async (_event, payload: OpenFilePayload) => {
    await openPlanFile(payload.filePath)
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, async () => {
    await openFileDialog()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE, async (_event, payload: PlanSavePayload) => {
    const content = stringifyPlan(payload.plan)
    selfWriteHashes.set(payload.filePath, hashContent(content))
    await writeFile(payload.filePath, content, 'utf-8')
  })
}

app.whenReady().then(async () => {
  buildAppMenu()
  registerIpcHandlers()
  const win = createWindow()

  // Auto-load the last-opened .plan file once the renderer is ready
  win.webContents.once('did-finish-load', async () => {
    const lastFile = await getLastOpenedFile()
    if (!lastFile) return

    try {
      await openPlanFile(lastFile)
    } catch {
      // File no longer exists or is invalid — fall through to Welcome screen
    }
  })
})

// Partial is a single-window app — quit on all platforms when the window closes.
app.on('window-all-closed', () => {
  app.quit()
})

// Clean up watcher on quit
app.on('will-quit', async () => {
  if (activeWatcher) {
    await activeWatcher.close()
    activeWatcher = null
  }
})
