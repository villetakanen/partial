import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PlanFile, Task } from '@shared/types'

const FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures')

/**
 * Read a fixture file from `tests/fixtures/` and return its contents as a string.
 *
 * @param name - Filename within the fixtures directory (e.g. `"minimal.plan"`)
 * @returns The file content as a UTF-8 string
 */
export async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURES_DIR, name), 'utf-8')
}

/**
 * Build a typed `PlanFile` with sensible defaults.
 * Any field can be overridden via the `overrides` parameter.
 *
 * @param overrides - Partial fields to merge into the default plan
 * @returns A complete `PlanFile` object
 */
export function createPlan(overrides?: Partial<PlanFile>): PlanFile {
  return {
    version: '1.0.0',
    project: 'test-project',
    tasks: [],
    ...overrides,
  }
}

/**
 * Build a typed `Task` with sensible defaults.
 * Any field can be overridden via the `overrides` parameter.
 *
 * @param overrides - Partial fields to merge into the default task
 * @returns A complete `Task` object
 */
export function createTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    done: false,
    ...overrides,
  }
}
