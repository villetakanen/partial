// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import List from '../../src/renderer/views/List.svelte'
import { buildDAG } from '../../src/shared/dag'
import type { PlanFile, Task } from '../../src/shared/types'
import { createPlan, createTask } from '../helpers'

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    openFile: vi.fn(),
    showOpenDialog: vi.fn(),
    savePlan: vi.fn(),
    onPlanUpdated: vi.fn(),
    onPlanDeleted: vi.fn(),
    onPlanError: vi.fn(),
    offPlanUpdated: vi.fn(),
    offPlanDeleted: vi.fn(),
    offPlanError: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    setSettings: vi.fn().mockResolvedValue(undefined),
  }
})

afterEach(() => {
  cleanup()
})

function renderList(tasks: Task[]) {
  const plan: PlanFile = createPlan({ tasks })
  const dag = buildDAG(tasks)
  return render(List, { props: { plan, dag } })
}

describe('List', () => {
  it('renders table with correct column headers', () => {
    const tasks: Task[] = [createTask({ id: 'a', title: 'Task A' })]
    const { container } = renderList(tasks)
    const headers = Array.from(container.querySelectorAll('th')).map((h) => h.textContent)
    expect(headers).toEqual([
      'Done',
      'ID',
      'Title',
      'State',
      'Parent',
      'Start',
      'Due',
      'Duration',
      'Needs',
    ])
  })

  it('renders task rows', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: false }),
    ]
    const { container } = renderList(tasks)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
  })

  it('displays task data in cells', () => {
    const tasks: Task[] = [
      createTask({ id: 'b', title: 'Task B' }),
      createTask({ id: 'c', title: 'Task C' }),
      createTask({
        id: 'a',
        title: 'Task A',
        done: false,
        needs: ['b', 'c'],
        parent: 'root',
        state: 'ready',
      }),
    ]
    const { container } = renderList(tasks)
    // Find the row for task 'a' (3rd row, index 2)
    const rows = container.querySelectorAll('tbody tr')
    const cells = rows[2].querySelectorAll('td')
    // done (checkbox), id, title, state, parent, start, due, duration, needs
    expect(cells[1]?.textContent).toBe('a')
    expect(cells[2]?.textContent).toBe('Task A')
    expect(cells[3]?.textContent).toBe('ready')
    expect(cells[4]?.textContent).toBe('root')
    expect(cells[8]?.textContent).toBe('b, c')
  })

  it('shows empty placeholder when no tasks', () => {
    const { container } = renderList([])
    expect(container.querySelector('.empty-placeholder')?.textContent).toBe('No tasks to display')
  })

  it('renders checkboxes for done column', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: false }),
    ]
    const { container } = renderList(tasks)
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
    expect(checkboxes[0].checked).toBe(true)
    expect(checkboxes[1].checked).toBe(false)
  })

  it('applies done class to completed task rows', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: false }),
    ]
    const { container } = renderList(tasks)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows[0].classList.contains('done')).toBe(true)
    expect(rows[1].classList.contains('done')).toBe(false)
  })

  it('sorts tasks when clicking sortable headers', async () => {
    const tasks: Task[] = [
      createTask({ id: 'c', title: 'Zebra' }),
      createTask({ id: 'a', title: 'Alpha' }),
      createTask({ id: 'b', title: 'Middle' }),
    ]
    const { container } = renderList(tasks)

    // Click on Title header to sort ascending
    const titleHeader = Array.from(container.querySelectorAll('th')).find((h) =>
      h.textContent?.startsWith('Title'),
    )
    titleHeader?.click()
    await tick()

    const cells = container.querySelectorAll('tbody td.col-title')
    const titles = Array.from(cells).map((c) => c.textContent)
    expect(titles).toEqual(['Alpha', 'Middle', 'Zebra'])
  })
})
