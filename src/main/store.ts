import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppSettings } from '@shared/ipc'
import { app } from 'electron'

/**
 * Return the absolute path to the settings JSON file in Electron's userData directory.
 * The file lives at `<userData>/partial-settings.json`.
 */
function getSettingsPath(): string {
  return join(app.getPath('userData'), 'partial-settings.json')
}

/**
 * Read the app settings from disk.
 * Returns an empty object if the file does not exist or is malformed.
 */
export async function readSettings(): Promise<AppSettings> {
  try {
    const content = await readFile(getSettingsPath(), 'utf-8')
    const parsed: unknown = JSON.parse(content)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as AppSettings
    }
    return {}
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.error('[store] Failed to read settings:', error.message)
    }
    return {}
  }
}

/**
 * Write the app settings to disk, creating the directory if needed.
 * Merges the given partial settings with the existing ones.
 */
export async function writeSettings(partial: Partial<AppSettings>): Promise<void> {
  const existing = await readSettings()
  const merged = { ...existing, ...partial }
  const settingsPath = getSettingsPath()
  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf-8')
}

/**
 * Get the last successfully opened `.plan` file path, or `undefined` if none is stored.
 */
export async function getLastOpenedFile(): Promise<string | undefined> {
  const settings = await readSettings()
  if (typeof settings.lastOpenedFile === 'string' && settings.lastOpenedFile.length > 0) {
    return settings.lastOpenedFile
  }
  return undefined
}

/**
 * Persist the path of the last successfully opened `.plan` file.
 */
export async function setLastOpenedFile(filePath: string): Promise<void> {
  await writeSettings({ lastOpenedFile: filePath })
}
