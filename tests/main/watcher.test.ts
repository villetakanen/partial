import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
}, 30000)
