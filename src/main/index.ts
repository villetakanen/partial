import { join } from 'node:path'
import type { OpenDirectoryPayload, PlanSavePayload } from '@shared/ipc'
import { IPC_CHANNELS } from '@shared/ipc'
import { app, BrowserWindow, ipcMain } from 'electron'

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
 * Register IPC handlers for renderer → main communication.
 */
function registerIpcHandlers(): void {
	ipcMain.handle(IPC_CHANNELS.OPEN_DIRECTORY, async (_event, payload: OpenDirectoryPayload) => {
		// Stub: watcher integration will be added in PBI-021
		console.log('open-directory:', payload.dirPath)
	})

	ipcMain.handle(IPC_CHANNELS.SAVE, async (_event, payload: PlanSavePayload) => {
		// Stub: file write will be added in PBI-021
		console.log('save:', payload.filePath)
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
