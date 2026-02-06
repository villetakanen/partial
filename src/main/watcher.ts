import { readFile } from 'node:fs/promises'
import type { PlanFile } from '@shared/types'
import { watch } from 'chokidar'
import { parsePlan } from './parser'

/** Handler for change events (file created or modified with parsed content). */
type ChangeHandler = (filePath: string, plan: PlanFile) => void

/** Handler for delete events (file removed from disk). */
type DeleteHandler = (filePath: string) => void

/** Options for {@link watchDirectory}. */
export interface WatchOptions {
	/** Debounce interval in milliseconds. Defaults to 100. */
	debounce?: number
}

/**
 * Watcher instance returned by {@link watchDirectory}.
 *
 * Emits events when `.plan` files in the watched directory are
 * created, modified, or deleted.
 */
export interface PlanWatcher {
	/** Register a handler for file change (create/modify) or delete events. */
	on(event: 'change', handler: ChangeHandler): void
	on(event: 'delete', handler: DeleteHandler): void
	/** Stop watching and clean up all resources including pending debounce timers. */
	close(): Promise<void>
	/** Resolves when the watcher has finished initial scan and is ready. */
	ready: Promise<void>
}

/**
 * Start watching a directory for `.plan` file changes.
 *
 * Monitors the given directory for `*.plan` files using chokidar.
 * When a `.plan` file is created or modified, it is read from disk,
 * parsed via {@link parsePlan}, and a `change` event is emitted with
 * the parsed {@link PlanFile}. When a `.plan` file is deleted, a
 * `delete` event is emitted with the file path.
 *
 * Rapid successive events for the same file are debounced — only the
 * final state is emitted after the debounce interval elapses.
 *
 * Hidden files (starting with `.`) and non-`.plan` files are ignored.
 *
 * @param dirPath - Absolute path to the directory to watch
 * @param options - Optional configuration (debounce interval, etc.)
 * @returns A {@link PlanWatcher} instance for subscribing to events
 */
export function watchDirectory(dirPath: string, options?: WatchOptions): PlanWatcher {
	const debounceMs = options?.debounce ?? 100
	const changeHandlers: ChangeHandler[] = []
	const deleteHandlers: DeleteHandler[] = []
	const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

	const watcher = watch(dirPath, {
		ignoreInitial: true,
		ignored: (path, stats) => {
			// Allow directories and unresolved paths through for scanning
			if (!stats?.isFile()) return false
			// Ignore hidden files and anything not ending in .plan
			const base = path.split('/').pop() ?? ''
			return base.startsWith('.') || !base.endsWith('.plan')
		},
		depth: 0,
	})

	const readyPromise = new Promise<void>((resolve) => {
		watcher.on('ready', () => resolve())
	})

	const emitChange = async (filePath: string) => {
		const content = await readFile(filePath, 'utf-8')
		const plan = parsePlan(content)
		for (const handler of changeHandlers) {
			handler(filePath, plan)
		}
	}

	const scheduleChange = (filePath: string) => {
		const existing = pendingTimers.get(filePath)
		if (existing) clearTimeout(existing)
		pendingTimers.set(
			filePath,
			setTimeout(() => {
				pendingTimers.delete(filePath)
				emitChange(filePath)
			}, debounceMs),
		)
	}

	watcher.on('add', (path) => {
		scheduleChange(path)
	})

	watcher.on('change', (path) => {
		scheduleChange(path)
	})

	watcher.on('unlink', (path) => {
		// Cancel any pending change for a deleted file
		const existing = pendingTimers.get(path)
		if (existing) {
			clearTimeout(existing)
			pendingTimers.delete(path)
		}
		for (const handler of deleteHandlers) {
			handler(path)
		}
	})

	return {
		on(event: string, handler: ChangeHandler | DeleteHandler) {
			if (event === 'change') {
				changeHandlers.push(handler as ChangeHandler)
			} else if (event === 'delete') {
				deleteHandlers.push(handler as DeleteHandler)
			}
		},
		async close() {
			for (const timer of pendingTimers.values()) {
				clearTimeout(timer)
			}
			pendingTimers.clear()
			await watcher.close()
		},
		ready: readyPromise,
	}
}
