import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlanParseError } from '@main/parser'
import { type PlanWatcher, watchDirectory } from '@main/watcher'
import type { PlanFile } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const VALID_PLAN = `
version: "1.0.0"
project: Test
tasks:
  - id: a
    title: Task A
`

/** Wait for a change event with timeout. */
function waitForChange(
  watcher: PlanWatcher,
  timeout = 5000,
): Promise<{ filePath: string; plan: PlanFile }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for change event')), timeout)
    watcher.on('change', (filePath, plan) => {
      clearTimeout(timer)
      resolve({ filePath, plan })
    })
  })
}

/** Wait for a delete event with timeout. */
function waitForDelete(watcher: PlanWatcher, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for delete event')), timeout)
    watcher.on('delete', (filePath) => {
      clearTimeout(timer)
      resolve(filePath)
    })
  })
}

/** Wait for an error event with timeout. */
function waitForError(
  watcher: PlanWatcher,
  timeout = 5000,
): Promise<{ filePath: string; error: PlanParseError }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for error event')), timeout)
    watcher.on('error', (filePath, error) => {
      clearTimeout(timer)
      resolve({ filePath, error })
    })
  })
}

/** Collect all change events over a duration. */
function collectChanges(
  watcher: PlanWatcher,
  duration: number,
): Promise<Array<{ filePath: string; plan: PlanFile }>> {
  return new Promise((resolve) => {
    const events: Array<{ filePath: string; plan: PlanFile }> = []
    watcher.on('change', (filePath, plan) => {
      events.push({ filePath, plan })
    })
    setTimeout(() => resolve(events), duration)
  })
}

describe('watchDirectory', () => {
  let tmpDir: string
  let watcher: PlanWatcher

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-watcher-'))
  })

  afterEach(async () => {
    if (watcher) {
      await watcher.close()
    }
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('emits change event when a .plan file is created', async () => {
    watcher = watchDirectory(tmpDir)
    await watcher.ready
    const promise = waitForChange(watcher)
    await writeFile(join(tmpDir, 'test.plan'), VALID_PLAN)

    const result = await promise
    expect(result.filePath).toContain('test.plan')
    expect(result.plan.project).toBe('Test')
    expect(result.plan.tasks).toHaveLength(1)
  })

  it('emits change event when a .plan file is modified', async () => {
    const filePath = join(tmpDir, 'modify.plan')
    await writeFile(filePath, VALID_PLAN)

    watcher = watchDirectory(tmpDir)
    await watcher.ready

    const promise = waitForChange(watcher)
    await writeFile(filePath, VALID_PLAN.replace('Test', 'Modified'))

    const result = await promise
    expect(result.filePath).toContain('modify.plan')
    expect(result.plan.project).toBe('Modified')
  })

  it('emits delete event when a .plan file is removed', async () => {
    const filePath = join(tmpDir, 'delete.plan')
    await writeFile(filePath, VALID_PLAN)

    watcher = watchDirectory(tmpDir)
    await watcher.ready

    const promise = waitForDelete(watcher)
    await unlink(filePath)

    const deletedPath = await promise
    expect(deletedPath).toContain('delete.plan')
  })

  it('ignores non-.plan files', async () => {
    watcher = watchDirectory(tmpDir)
    await watcher.ready

    let eventFired = false
    watcher.on('change', () => {
      eventFired = true
    })

    await writeFile(join(tmpDir, 'readme.md'), '# Hello')
    await writeFile(join(tmpDir, 'data.json'), '{}')
    await writeFile(join(tmpDir, 'notes.txt'), 'some text')

    await new Promise((r) => setTimeout(r, 500))
    expect(eventFired).toBe(false)
  })

  it('ignores hidden files', async () => {
    watcher = watchDirectory(tmpDir)
    await watcher.ready

    let eventFired = false
    watcher.on('change', () => {
      eventFired = true
    })

    await writeFile(join(tmpDir, '.hidden.plan'), VALID_PLAN)

    await new Promise((r) => setTimeout(r, 500))
    expect(eventFired).toBe(false)
  })

  it('close() stops emitting events', async () => {
    watcher = watchDirectory(tmpDir)
    await watcher.ready
    await watcher.close()

    let eventFired = false
    watcher.on('change', () => {
      eventFired = true
    })

    await writeFile(join(tmpDir, 'after-close.plan'), VALID_PLAN)

    await new Promise((r) => setTimeout(r, 500))
    expect(eventFired).toBe(false)
  })
})

describe('watchDirectory debouncing', () => {
  let tmpDir: string
  let watcher: PlanWatcher

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-debounce-'))
  })

  afterEach(async () => {
    if (watcher) {
      await watcher.close()
    }
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('debounces 5 rapid writes into 1 event', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 100 })
    await watcher.ready

    const filePath = join(tmpDir, 'rapid.plan')
    // Collect events over 1 second (enough for debounce to settle)
    const eventsPromise = collectChanges(watcher, 1000)

    // Write 5 times rapidly (within 50ms)
    for (let i = 1; i <= 5; i++) {
      await writeFile(filePath, VALID_PLAN.replace('Test', `Version${i}`))
    }

    const events = await eventsPromise
    expect(events).toHaveLength(1)
    expect(events[0].plan.project).toBe('Version5')
  })

  it('debounce interval is configurable', async () => {
    // Use a very short debounce to verify configurability
    watcher = watchDirectory(tmpDir, { debounce: 10 })
    await watcher.ready

    const promise = waitForChange(watcher)
    await writeFile(join(tmpDir, 'quick.plan'), VALID_PLAN)

    const result = await promise
    expect(result.plan.project).toBe('Test')
  })

  it('default debounce is 100ms', async () => {
    watcher = watchDirectory(tmpDir)
    await watcher.ready

    const filePath = join(tmpDir, 'default.plan')
    const eventsPromise = collectChanges(watcher, 1000)

    // Write twice rapidly — should be debounced into 1 event
    await writeFile(filePath, VALID_PLAN.replace('Test', 'First'))
    await writeFile(filePath, VALID_PLAN.replace('Test', 'Second'))

    const events = await eventsPromise
    expect(events).toHaveLength(1)
    expect(events[0].plan.project).toBe('Second')
  })

  it('emits the final file state after debounce', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 50 })
    await watcher.ready

    const filePath = join(tmpDir, 'final.plan')
    const promise = waitForChange(watcher)

    await writeFile(filePath, VALID_PLAN.replace('Test', 'Initial'))
    await writeFile(filePath, VALID_PLAN.replace('Test', 'Middle'))
    await writeFile(filePath, VALID_PLAN.replace('Test', 'Final'))

    const result = await promise
    expect(result.plan.project).toBe('Final')
  })
}, 30000)

describe('watchDirectory error handling', () => {
  let tmpDir: string
  let watcher: PlanWatcher

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-errors-'))
  })

  afterEach(async () => {
    if (watcher) {
      await watcher.close()
    }
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('emits error event for invalid YAML', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 10 })
    await watcher.ready

    const promise = waitForError(watcher)
    await writeFile(join(tmpDir, 'broken.plan'), 'tasks:\n  - id: a\n    title: [invalid')

    const result = await promise
    expect(result.filePath).toContain('broken.plan')
    expect(result.error).toBeInstanceOf(PlanParseError)
    expect(result.error.message.length).toBeGreaterThan(0)
  })

  it('error event includes filePath and structured parse error', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 10 })
    await watcher.ready

    const promise = waitForError(watcher)
    await writeFile(join(tmpDir, 'schema.plan'), 'version: "1.0.0"\ntasks:\n  - title: No ID')

    const result = await promise
    expect(result.filePath).toContain('schema.plan')
    expect(result.error).toBeInstanceOf(PlanParseError)
    expect(result.error.message).toContain('Validation error')
  })

  it('continues watching after an error', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 10 })
    await watcher.ready

    // First: write invalid file, expect error
    const errorPromise = waitForError(watcher)
    await writeFile(join(tmpDir, 'recover.plan'), 'invalid: [yaml')
    await errorPromise

    // Then: write valid file, expect change
    const changePromise = waitForChange(watcher)
    await writeFile(join(tmpDir, 'recover.plan'), VALID_PLAN)

    const result = await changePromise
    expect(result.plan.project).toBe('Test')
  })

  it('subsequent valid save emits normal change event', async () => {
    watcher = watchDirectory(tmpDir, { debounce: 10 })
    await watcher.ready

    const filePath = join(tmpDir, 'flip.plan')

    // Error first
    const errorPromise = waitForError(watcher)
    await writeFile(filePath, 'tasks:\n  - title: Missing ID')
    await errorPromise

    // Valid second
    const changePromise = waitForChange(watcher)
    await writeFile(filePath, VALID_PLAN)
    const result = await changePromise
    expect(result.filePath).toContain('flip.plan')
    expect(result.plan.project).toBe('Test')
  })
}, 30000)
