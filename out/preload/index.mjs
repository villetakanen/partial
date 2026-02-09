import { contextBridge, ipcRenderer } from "electron";
const IPC_CHANNELS = {
  /** main → renderer: Plan file changed on disk */
  PLAN_UPDATED: "plan:updated",
  /** main → renderer: Plan file deleted */
  PLAN_DELETED: "plan:deleted",
  /** main → renderer: Parse error on a plan file */
  PLAN_ERROR: "plan:error",
  /** renderer → main: Open a .plan file by path */
  OPEN_FILE: "plan:open-file",
  /** renderer → main: Show the native file picker dialog */
  SHOW_OPEN_DIALOG: "plan:show-open-dialog",
  /** renderer → main: User saves changes from UI */
  SAVE: "plan:save",
  /** renderer → main: Read current settings */
  SETTINGS_GET: "settings:get",
  /** renderer → main: Write (merge) settings */
  SETTINGS_SET: "settings:set"
};
const api = {
  openFile(payload) {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, payload);
  },
  showOpenDialog() {
    return ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_DIALOG);
  },
  savePlan(payload) {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE, payload);
  },
  getSettings() {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET);
  },
  setSettings(settings) {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings);
  },
  onPlanUpdated(callback) {
    ipcRenderer.on(IPC_CHANNELS.PLAN_UPDATED, (_event, payload) => {
      callback(payload);
    });
  },
  onPlanDeleted(callback) {
    ipcRenderer.on(IPC_CHANNELS.PLAN_DELETED, (_event, payload) => {
      callback(payload);
    });
  },
  onPlanError(callback) {
    ipcRenderer.on(IPC_CHANNELS.PLAN_ERROR, (_event, payload) => {
      callback(payload);
    });
  },
  offPlanUpdated() {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_UPDATED);
  },
  offPlanDeleted() {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_DELETED);
  },
  offPlanError() {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PLAN_ERROR);
  }
};
contextBridge.exposeInMainWorld("api", api);
