import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parsePlan, stringifyPlan } from '@main/parser'
import { describe, expect, it } from 'vitest'

const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures')

async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURES_DIR, name), 'utf-8')
}

/**
 * Parse → stringify → parse and assert deep equality with the first parse.
 */
function assertRoundTrip(content: string): void {
  const first = parsePlan(content)
  const yaml = stringifyPlan(first)
  const second = parsePlan(yaml)
  expect(second).toStrictEqual(first)
}

describe('parser round-trip', () => {
  it('round-trips a minimal .plan file', async () => {
    const content = await loadFixture('minimal.plan')
    assertRoundTrip(content)
  })

  it('round-trips a complex .plan file with dependencies', async () => {
    const content = await loadFixture('complex.plan')
    assertRoundTrip(content)
  })

  it('round-trips a .plan file with unknown fields', async () => {
    const content = await loadFixture('unknown-fields.plan')
    assertRoundTrip(content)
  })

  it('preserves unknown root-level fields', async () => {
    const content = await loadFixture('unknown-fields.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    expect(second.custom_metadata).toStrictEqual({
      author: 'alice',
      created: '2025-01-15',
      tags: ['experimental', 'prototype'],
    })
  })

  it('preserves unknown task-level fields', async () => {
    const content = await loadFixture('unknown-fields.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    const task1 = second.tasks.find((t) => t.id === 'task-1')
    expect(task1?.priority).toBe('high')
    expect(task1?.estimate).toBe(3)
    expect(task1?.labels).toStrictEqual(['frontend', 'urgent'])
  })

  it('preserves nested unknown fields', async () => {
    const content = await loadFixture('unknown-fields.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    const task2 = second.tasks.find((t) => t.id === 'task-2')
    expect(task2?.custom_data).toStrictEqual({
      reviewer: 'bob',
      notes: 'needs review',
    })
  })

  it('handles all four dependency types', async () => {
    const content = await loadFixture('complex.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    const charlie = second.tasks.find((t) => t.id === 'charlie')
    expect(charlie?.needs).toStrictEqual(['alpha'])
    expect(charlie?.needs_ss).toStrictEqual(['bravo'])

    const delta = second.tasks.find((t) => t.id === 'delta')
    expect(delta?.needs_fs).toStrictEqual(['bravo'])
    expect(delta?.needs_ff).toStrictEqual(['charlie'])

    const echo = second.tasks.find((t) => t.id === 'echo')
    expect(echo?.needs_sf).toStrictEqual(['delta'])
  })

  it('preserves task done status through round-trip', async () => {
    const content = await loadFixture('complex.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    const alpha = second.tasks.find((t) => t.id === 'alpha')
    const bravo = second.tasks.find((t) => t.id === 'bravo')
    const charlie = second.tasks.find((t) => t.id === 'charlie')

    expect(alpha?.done).toBe(true)
    expect(bravo?.done).toBe(true)
    expect(charlie?.done).toBe(false)
  })

  it('preserves parent field through round-trip', async () => {
    const content = await loadFixture('complex.plan')
    const first = parsePlan(content)
    const yaml = stringifyPlan(first)
    const second = parsePlan(yaml)

    const foxtrot = second.tasks.find((t) => t.id === 'foxtrot')
    expect(foxtrot?.parent).toBe('group-a')
  })

  it('multiple round-trips produce identical results', async () => {
    const content = await loadFixture('unknown-fields.plan')
    const first = parsePlan(content)
    const yaml1 = stringifyPlan(first)
    const second = parsePlan(yaml1)
    const yaml2 = stringifyPlan(second)
    const third = parsePlan(yaml2)

    expect(second).toStrictEqual(first)
    expect(third).toStrictEqual(first)
    expect(yaml2).toBe(yaml1)
  })
})
