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
  SAVE: "plan:save"
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
  }
};
contextBridge.exposeInMainWorld("api", api);
