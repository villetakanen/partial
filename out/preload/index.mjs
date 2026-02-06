import { contextBridge, ipcRenderer } from "electron";
const IPC_CHANNELS = {
  /** main → renderer: Plan file changed on disk */
  PLAN_UPDATED: "plan:updated",
  /** main → renderer: Plan file deleted */
  PLAN_DELETED: "plan:deleted",
  /** main → renderer: Parse error on a plan file */
  PLAN_ERROR: "plan:error",
  /** renderer → main: User selects a project directory */
  OPEN_DIRECTORY: "plan:open-directory",
  /** renderer → main: User saves changes from UI */
  SAVE: "plan:save"
};
const api = {
  openDirectory(payload) {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIRECTORY, payload);
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
