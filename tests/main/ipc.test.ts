import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@shared/ipc'
import type { PlanFile } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for Electron IPC handlers.
 *
 * Rather than launching a full Electron app, we mock the `electron` module
 * and dynamically import `src/main/index.ts` so `registerIpcHandlers()`
 * registers real handlers on our mock `ipcMain`. We then invoke these
 * handlers directly and observe the results through mock `BrowserWindow`.
 */

// ── Mocks ────────────────────────────────────────────────────────

/** Captured IPC handlers registered via `ipcMain.handle`. */
const ipcHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

/** Messages sent to renderer windows via `webContents.send`. */
const sentMessages: Array<{ channel: string; payload: unknown }> = []

/** Fake webContents with a `send` spy. */
const fakeWebContents = {
  send: (channel: string, payload: unknown) => {
    sentMessages.push({ channel, payload })
  },
  once: vi.fn(),
}

/** Create a fresh fake BrowserWindow instance. */
function createFakeWindow() {
  return {
    webContents: fakeWebContents,
    loadURL: vi.fn(),
    loadFile: vi.fn(),
  }
}

/** Tracks all created windows for `getAllWindows`. */
const allWindows: ReturnType<typeof createFakeWindow>[] = []

// Mock electron before importing the module under test.
// BrowserWindow must be a real function so `new BrowserWindow(...)` works.
vi.mock('electron', () => {
  function BrowserWindow() {
    const win = createFakeWindow()
    allWindows.push(win)
    return win
  }
  BrowserWindow.getAllWindows = () => allWindows

  return {
    app: {
      whenReady: () => Promise.resolve(),
      on: vi.fn(),
      name: 'Partial',
      getPath: () => tmpdir(),
      quit: vi.fn(),
    },
    BrowserWindow,
    ipcMain: {
      handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        ipcHandlers.set(channel, handler)
      },
    },
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    },
    Menu: {
      buildFromTemplate: vi.fn().mockReturnValue({}),
      setApplicationMenu: vi.fn(),
    },
  }
})

// ── Test Setup ───────────────────────────────────────────────────

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'partial-ipc-'))
  sentMessages.length = 0
  ipcHandlers.clear()

  // Dynamically import the module to trigger handler registration.
  // resetModules ensures each test gets a fresh module state.
  vi.resetModules()
  await import('../../src/main/index')

  // Wait a tick for async whenReady to resolve
  await new Promise((r) => setTimeout(r, 50))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ── Helpers ──────────────────────────────────────────────────────

/** Retrieve a registered IPC handler or fail the test. */
function getHandler(channel: string) {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`Handler not registered for channel: ${channel}`)
  return handler
}

/** Find the first sent message on `channel` or fail the test. */
function findMessage(channel: string) {
  const msg = sentMessages.find((m) => m.channel === channel)
  if (!msg) throw new Error(`No message found on channel: ${channel}`)
  return msg
}

// ── Tests ────────────────────────────────────────────────────────

describe('IPC handler: plan:open-file', () => {
  it('reads, parses, and sends plan:updated for a valid .plan file', async () => {
    const filePath = join(tmpDir, 'test.plan')
    await writeFile(
      filePath,
      `version: "1.0.0"\nproject: IPC Test\ntasks:\n  - id: t1\n    title: Task One\n`,
    )

    const handler = getHandler(IPC_CHANNELS.OPEN_FILE)
    await handler({}, { filePath })

    const updated = findMessage(IPC_CHANNELS.PLAN_UPDATED)
    const payload = updated.payload as { filePath: string; plan: PlanFile }
    expect(payload.filePath).toBe(filePath)
    expect(payload.plan.project).toBe('IPC Test')
    expect(payload.plan.tasks).toHaveLength(1)
    expect(payload.plan.tasks[0].id).toBe('t1')
  })

  it('starts a watcher that sends plan:updated on file change', async () => {
    const filePath = join(tmpDir, 'watched.plan')
    await writeFile(
      filePath,
      `version: "1.0.0"\nproject: Original\ntasks:\n  - id: w1\n    title: Watch Me\n`,
    )

    const handler = getHandler(IPC_CHANNELS.OPEN_FILE)
    await handler({}, { filePath })

    // Clear the initial plan:updated message
    sentMessages.length = 0

    // Modify the file — watcher should fire plan:updated
    await writeFile(
      filePath,
      `version: "1.0.0"\nproject: Changed\ntasks:\n  - id: w1\n    title: Watch Me\n`,
    )

    // Wait for watcher debounce (100ms default) + processing
    await new Promise((r) => setTimeout(r, 500))

    const updated = findMessage(IPC_CHANNELS.PLAN_UPDATED)
    const payload = updated.payload as { filePath: string; plan: PlanFile }
    expect(payload.plan.project).toBe('Changed')
  })

  it('sends plan:error when a watched file has invalid YAML', async () => {
    const filePath = join(tmpDir, 'error.plan')
    await writeFile(
      filePath,
      `version: "1.0.0"\nproject: Valid\ntasks:\n  - id: e1\n    title: Start Valid\n`,
    )

    const handler = getHandler(IPC_CHANNELS.OPEN_FILE)
    await handler({}, { filePath })

    // Clear the initial plan:updated message
    sentMessages.length = 0

    // Write invalid YAML to the file
    await writeFile(filePath, 'tasks:\n  - title: [broken yaml')

    // Wait for watcher debounce + processing
    await new Promise((r) => setTimeout(r, 500))

    const errorMsg = findMessage(IPC_CHANNELS.PLAN_ERROR)
    const payload = errorMsg.payload as { filePath: string; error: string }
    expect(payload.filePath).toContain('error.plan')
    expect(payload.error.length).toBeGreaterThan(0)
  })
})

describe('IPC handler: plan:save', () => {
  it('writes content to disk and suppresses self-write watcher event', async () => {
    const filePath = join(tmpDir, 'save.plan')
    await writeFile(
      filePath,
      `version: "1.0.0"\nproject: Before\ntasks:\n  - id: s1\n    title: Save Test\n`,
    )

    // Open the file first to start watching
    const openHandler = getHandler(IPC_CHANNELS.OPEN_FILE)
    await openHandler({}, { filePath })
    sentMessages.length = 0

    // Save via IPC
    const saveHandler = getHandler(IPC_CHANNELS.SAVE)

    const planToSave: PlanFile = {
      version: '1.0.0',
      project: 'Saved',
      tasks: [{ id: 's1', title: 'Save Test' }],
    }
    await saveHandler({}, { filePath, plan: planToSave })

    // Wait for watcher debounce — self-write should be suppressed
    await new Promise((r) => setTimeout(r, 500))

    // No plan:updated should have been sent (self-write suppressed)
    const updates = sentMessages.filter((m) => m.channel === IPC_CHANNELS.PLAN_UPDATED)
    expect(updates).toHaveLength(0)
  })
})

describe('IPC handler: plan:show-open-dialog', () => {
  it('handler is registered', () => {
    const handler = ipcHandlers.get(IPC_CHANNELS.SHOW_OPEN_DIALOG)
    expect(handler).toBeDefined()
  })
})
