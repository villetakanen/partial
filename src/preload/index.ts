import type {
  AppSettings,
  OpenFilePayload,
  PartialAPI,
  PlanDeletedPayload,
  PlanErrorPayload,
  PlanSavePayload,
  PlanUpdatedPayload,
} from '@shared/ipc'
import { IPC_CHANNELS } from '@shared/ipc'
import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload script — exposes a typed API to the renderer via contextBridge.
 * The renderer accesses this as `window.api`.
 */
const api: PartialAPI = {
  openFile(payload: OpenFilePayload): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, payload)
  },

  showOpenDialog(): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_DIALOG)
  },

  savePlan(payload: PlanSavePayload): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE, payload)
  },

  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET)
  },

  setSettings(settings: Partial<AppSettings>): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings)
  },

  onPlanUpdated(callback: (payload: PlanUpdatedPayload) => void): void {
    ipcRenderer.on(IPC_CHANNELS.PLAN_UPDATED, (_event, payload) => {
      callback(payload as PlanUpdatedPayload)
    })
  },

  onPlanDeleted(callback: (payload: PlanDeletedPayload) => void): void {
    ipcRenderer.on(IPC_CHANNELS.PLAN_DELETED, (_event, payload) => {
      callback(payload as PlanDeletedPayload)
    })
  },

  onPlanError(callback: (payload: PlanErrorPayload) => void): void {
    ipcRenderer.on(IPC_CHANNELS.PLAN_ERROR, (_event, payload) => {
      callback(payload as PlanErrorPayload)
    })
  },

  offPlanUpdated(): void {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_UPDATED)
  },

  offPlanDeleted(): void {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_DELETED)
  },

  offPlanError(): void {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_ERROR)
  },
}

contextBridge.exposeInMainWorld('api', api)
