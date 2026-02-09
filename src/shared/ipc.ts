import type { PlanFile } from './types'

/**
 * App-wide settings persisted to disk.
 * The renderer reads/writes these via IPC.
 */
export interface AppSettings {
  /** Last opened .plan file path */
  lastOpenedFile?: string
  /** Base font size in pixels (default: 14) */
  fontSize?: number
  /** Preserve unknown fields for forward compatibility */
  [key: string]: unknown
}

/**
 * IPC channel names shared between main and renderer processes.
 * Using constants prevents channel name mismatches.
 */
export const IPC_CHANNELS = {
  /** main → renderer: Plan file changed on disk */
  PLAN_UPDATED: 'plan:updated',
  /** main → renderer: Plan file deleted */
  PLAN_DELETED: 'plan:deleted',
  /** main → renderer: Parse error on a plan file */
  PLAN_ERROR: 'plan:error',
  /** renderer → main: Open a .plan file by path */
  OPEN_FILE: 'plan:open-file',
  /** renderer → main: Show the native file picker dialog */
  SHOW_OPEN_DIALOG: 'plan:show-open-dialog',
  /** renderer → main: User saves changes from UI */
  SAVE: 'plan:save',
  /** renderer → main: Read current settings */
  SETTINGS_GET: 'settings:get',
  /** renderer → main: Write (merge) settings */
  SETTINGS_SET: 'settings:set',
} as const

/** Payload for the `plan:updated` channel (main → renderer) */
export interface PlanUpdatedPayload {
  filePath: string
  plan: PlanFile
}

/** Payload for the `plan:deleted` channel (main → renderer) */
export interface PlanDeletedPayload {
  filePath: string
}

/** Payload for the `plan:error` channel (main → renderer) */
export interface PlanErrorPayload {
  filePath: string
  error: string
}

/** Payload for the `plan:open-file` channel (renderer → main) */
export interface OpenFilePayload {
  filePath: string
}

/** Payload for the `plan:save` channel (renderer → main) */
export interface PlanSavePayload {
  filePath: string
  plan: PlanFile
}

/**
 * Typed API exposed to the renderer process via `contextBridge`.
 * The renderer accesses this as `window.api`.
 */
export interface PartialAPI {
  /** Send a request to open a .plan file by path */
  openFile(payload: OpenFilePayload): Promise<void>
  /** Show the native file picker dialog to select a .plan file */
  showOpenDialog(): Promise<void>
  /** Send a request to save a plan file */
  savePlan(payload: PlanSavePayload): Promise<void>
  /** Read app settings */
  getSettings(): Promise<AppSettings>
  /** Write (merge) app settings */
  setSettings(settings: Partial<AppSettings>): Promise<void>
  /** Register a callback for plan updates */
  onPlanUpdated(callback: (payload: PlanUpdatedPayload) => void): void
  /** Register a callback for plan deletions */
  onPlanDeleted(callback: (payload: PlanDeletedPayload) => void): void
  /** Register a callback for plan errors */
  onPlanError(callback: (payload: PlanErrorPayload) => void): void
  /** Remove all listeners for plan updates */
  offPlanUpdated(): void
  /** Remove all listeners for plan deletions */
  offPlanDeleted(): void
  /** Remove all listeners for plan errors */
  offPlanError(): void
}
