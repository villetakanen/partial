import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
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
  SAVE: "plan:save"
};
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
  needs_sf: z.array(z.string()).optional()
}).passthrough();
const PlanFileSchema = z.object({
  version: z.string(),
  project: z.string(),
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
const selfWritePaths = /* @__PURE__ */ new Set();
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
  if (activeWatcher) {
    await activeWatcher.close();
    activeWatcher = null;
  }
  const watcher = watchDirectory(dirname(filePath));
  watcher.on("change", (changedPath, changedPlan) => {
    if (selfWritePaths.has(changedPath)) {
      selfWritePaths.delete(changedPath);
      return;
    }
    sendToAllWindows(IPC_CHANNELS.PLAN_UPDATED, { filePath: changedPath, plan: changedPlan });
  });
  watcher.on("delete", (deletedPath) => {
    selfWritePaths.delete(deletedPath);
    sendToAllWindows(IPC_CHANNELS.PLAN_DELETED, { filePath: deletedPath });
  });
  watcher.on("error", (errorPath, error) => {
    if (selfWritePaths.has(errorPath)) {
      selfWritePaths.delete(errorPath);
      return;
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
    selfWritePaths.add(payload.filePath);
    await writeFile(payload.filePath, content, "utf-8");
  });
}
app.whenReady().then(() => {
  buildAppMenu();
  registerIpcHandlers();
  createWindow();
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
