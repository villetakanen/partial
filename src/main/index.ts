import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

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
		},
	})

	if (process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
	}

	return mainWindow
}

app.whenReady().then(() => {
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
