import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, Menu, ipcMain, BrowserWindow, dialog } from "electron";
import { z } from "zod";
import { stringify, parse } from "yaml";
import { watch } from "chokidar";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
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
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO 8601 date (YYYY-MM-DD)");
const durationString = z.string().regex(/^\d+[dhwm]$/, "Expected duration like 3d, 1w, 2h, 1m");
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean().optional(),
  needs: z.array(z.string()).optional(),
  parent: z.string().optional(),
  type: z.string().optional(),
  state: z.string().optional(),
  needs_fs: z.array(z.string()).optional(),
  needs_ss: z.array(z.string()).optional(),
  needs_ff: z.array(z.string()).optional(),
  needs_sf: z.array(z.string()).optional(),
  start: isoDateString.optional(),
  due: isoDateString.optional(),
  duration: durationString.optional()
}).passthrough();
const PlanFileSchema = z.object({
  version: z.string(),
  project: z.string(),
  description: z.string().optional(),
  tasks: z.array(TaskSchema)
}).passthrough();
class PlanParseError extends Error {
  line;
  column;
  constructor(message, line, column) {
    super(message);
    this.name = "PlanParseError";
    this.line = line;
    this.column = column;
  }
}
function parsePlan(content) {
  const trimmed = content.trim();
  if (trimmed === "") {
    return { version: "1.0.0", project: "", tasks: [] };
  }
  let raw;
  try {
    raw = parse(trimmed);
  } catch (err) {
    if (err instanceof Error) {
      const yamlErr = err;
      const line = yamlErr.linePos?.[0]?.line;
      const col = yamlErr.linePos?.[0]?.col;
      throw new PlanParseError(err.message, line, col);
    }
    throw new PlanParseError(String(err));
  }
  if (raw == null || typeof raw !== "object") {
    return { version: "1.0.0", project: "", tasks: [] };
  }
  const data = raw;
  const withDefaults = {
    ...data,
    version: data.version ?? "1.0.0",
    project: data.project ?? "",
    tasks: Array.isArray(data.tasks) ? data.tasks.map((task) => ({
      ...task,
      done: task.done ?? false
    })) : []
  };
  const result = PlanFileSchema.safeParse(withDefaults);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new PlanParseError(`Validation error at ${issue.path.join(".")}: ${issue.message}`);
  }
  return result.data;
}
function stringifyPlan(plan) {
  return stringify(plan, {
    indent: 2,
    lineWidth: 0
  });
}
function getSettingsPath() {
  return join(app.getPath("userData"), "partial-settings.json");
}
async function readSettings() {
  try {
    const content = await readFile(getSettingsPath(), "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      console.error("[store] Failed to read settings:", error.message);
    }
    return {};
  }
}
async function writeSettings(partial) {
  const existing = await readSettings();
  const merged = { ...existing, ...partial };
  const settingsPath = getSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf-8");
}
async function getLastOpenedFile() {
  const settings = await readSettings();
  if (typeof settings.lastOpenedFile === "string" && settings.lastOpenedFile.length > 0) {
    return settings.lastOpenedFile;
  }
  return void 0;
}
async function setLastOpenedFile(filePath) {
  await writeSettings({ lastOpenedFile: filePath });
}
function watchDirectory(dirPath, options) {
  const debounceMs = 100;
  const changeHandlers = [];
  const deleteHandlers = [];
  const errorHandlers = [];
  const pendingTimers = /* @__PURE__ */ new Map();
  const watcher = watch(dirPath, {
    ignoreInitial: true,
    ignored: (path, stats) => {
      if (!stats?.isFile()) return false;
      const base = path.split("/").pop() ?? "";
      return base.startsWith(".") || !base.endsWith(".plan");
    },
    depth: 0
  });
  const readyPromise = new Promise((resolve) => {
    watcher.on("ready", () => resolve());
  });
  const emitChange = async (filePath) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const plan = parsePlan(content);
      for (const handler of changeHandlers) {
        handler(filePath, plan);
      }
    } catch (err) {
      const parseError = err instanceof PlanParseError ? err : new PlanParseError(err instanceof Error ? err.message : String(err));
      for (const handler of errorHandlers) {
        handler(filePath, parseError);
      }
    }
  };
  const scheduleChange = (filePath) => {
    const existing = pendingTimers.get(filePath);
    if (existing) clearTimeout(existing);
    pendingTimers.set(
      filePath,
      setTimeout(() => {
        pendingTimers.delete(filePath);
        emitChange(filePath);
      }, debounceMs)
    );
  };
  watcher.on("add", (path) => {
    scheduleChange(path);
  });
  watcher.on("change", (path) => {
    scheduleChange(path);
  });
  watcher.on("unlink", (path) => {
    const existing = pendingTimers.get(path);
    if (existing) {
      clearTimeout(existing);
      pendingTimers.delete(path);
    }
    for (const handler of deleteHandlers) {
      handler(path);
    }
  });
  return {
    on(event, handler) {
      if (event === "change") {
        changeHandlers.push(handler);
      } else if (event === "delete") {
        deleteHandlers.push(handler);
      } else if (event === "error") {
        errorHandlers.push(handler);
      }
    },
    async close() {
      for (const timer of pendingTimers.values()) {
        clearTimeout(timer);
      }
      pendingTimers.clear();
      await watcher.close();
    },
    ready: readyPromise
  };
}
let activeWatcher = null;
const selfWriteHashes = /* @__PURE__ */ new Map();
function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, "../preload/index.mjs")
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
function sendToAllWindows(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}
async function openPlanFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const plan = parsePlan(content);
  sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath, plan });
  await setLastOpenedFile(filePath);
  if (activeWatcher) {
    await activeWatcher.close();
    activeWatcher = null;
  }
  const watcher = watchDirectory(dirname(filePath));
  watcher.on("change", async (changedPath, changedPlan) => {
    const expectedHash = selfWriteHashes.get(changedPath);
    if (expectedHash) {
      selfWriteHashes.delete(changedPath);
      try {
        const currentContent = await readFile(changedPath, "utf-8");
        if (hashContent(currentContent) === expectedHash) return;
      } catch {
      }
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath: changedPath, plan: changedPlan });
  });
  watcher.on("delete", (deletedPath) => {
    selfWriteHashes.delete(deletedPath);
    sendToAllWindows(IPC_CHANNELS.PLAN_DELETED, { filePath: deletedPath });
  });
  watcher.on("error", async (errorPath, error) => {
    const expectedHash = selfWriteHashes.get(errorPath);
    if (expectedHash) {
      selfWriteHashes.delete(errorPath);
      try {
        const currentContent = await readFile(errorPath, "utf-8");
        if (hashContent(currentContent) === expectedHash) return;
      } catch {
      }
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_ERROR, {
      filePath: errorPath,
      error: error.message
    });
  });
  activeWatcher = watcher;
  await watcher.ready;
}
async function openFileDialog() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    title: "Open Plan File",
    filters: [{ name: "Plan Files", extensions: ["plan"] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return;
  }
  await openPlanFile(result.filePaths[0]);
}
function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    {
      label: "File",
      submenu: [
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            openFileDialog();
          }
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async (_event, payload) => {
    await openPlanFile(payload.filePath);
  });
  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, async () => {
    await openFileDialog();
  });
  ipcMain.handle(IPC_CHANNELS.SAVE, async (_event, payload) => {
    const content = stringifyPlan(payload.plan);
    selfWriteHashes.set(payload.filePath, hashContent(content));
    await writeFile(payload.filePath, content, "utf-8");
  });
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return readSettings();
  });
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    await writeSettings(settings);
  });
}
app.whenReady().then(async () => {
  buildAppMenu();
  registerIpcHandlers();
  const win = createWindow();
  win.webContents.once("did-finish-load", async () => {
    const lastFile = await getLastOpenedFile();
    if (!lastFile) return;
    try {
      await openPlanFile(lastFile);
    } catch {
    }
  });
});
app.on("window-all-closed", () => {
  app.quit();
});
app.on("will-quit", async () => {
  if (activeWatcher) {
    await activeWatcher.close();
    activeWatcher = null;
  }
});
