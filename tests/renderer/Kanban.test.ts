// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Kanban from '../../src/renderer/views/Kanban.svelte'
import { buildDAG } from '../../src/shared/dag'
import type { PlanFile, Task } from '../../src/shared/types'
import { createPlan, createTask } from '../helpers'

afterEach(() => {
  cleanup()
})

function renderKanban(tasks: Task[]) {
  const plan: PlanFile = createPlan({ tasks })
  const dag = buildDAG(tasks)
  return render(Kanban, { props: { plan, dag } })
}

/**
 * Get the four column elements from the rendered Kanban board.
 * Returns them in order: Blocked, Ready, In Progress, Done.
 */
function getColumns(container: HTMLElement) {
  return container.querySelectorAll<HTMLDivElement>('.column')
}

describe('Kanban', () => {
  it('renders four column headers', () => {
    const { container } = renderKanban([])
    const headers = container.querySelectorAll('.column-title')
    const labels = Array.from(headers).map((h) => h.textContent)
    expect(labels).toEqual(['Blocked', 'Ready', 'In Progress', 'Done'])
  })

  it('assigns tasks to correct columns for a known DAG', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: false, needs: ['a'] }),
      createTask({ id: 'c', title: 'Task C', done: false, needs: ['b'] }),
    ]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)

    // Column order: Blocked, Ready, In Progress, Done
    const blockedCol = columns[0]
    const readyCol = columns[1]
    const doneCol = columns[3]

    // Task A is done → Done column
    expect(doneCol.textContent).toContain('Task A')
    // Task B depends on A (done) → Ready column
    expect(readyCol.textContent).toContain('Task B')
    // Task C depends on B (not done) → Blocked column
    expect(blockedCol.textContent).toContain('Task C')
  })

  it('places in_progress tasks in the In Progress column', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'WIP task', done: false, state: 'in_progress' }),
    ]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)
    const ipCol = columns[2] // In Progress is the 3rd column

    expect(ipCol.textContent).toContain('WIP task')
  })

  it('collapses empty columns', () => {
    // Only done tasks — Blocked, Ready, and In Progress should be collapsed
    const tasks: Task[] = [createTask({ id: 'a', title: 'Done task', done: true })]

    const { container } = renderKanban(tasks)
    const collapsed = container.querySelectorAll('.column.collapsed')

    // 3 should be collapsed (blocked, ready, in_progress are empty)
    expect(collapsed.length).toBe(3)
  })

  it('does not collapse columns that have tasks', () => {
    const tasks: Task[] = [createTask({ id: 'a', title: 'Ready task', done: false })]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)
    const readyCol = columns[1] // Ready is 2nd column

    // Ready column should not be collapsed since it has a task
    expect(readyCol.classList.contains('collapsed')).toBe(false)

    // But Blocked, In Progress, Done should be collapsed
    const collapsed = container.querySelectorAll('.column.collapsed')
    expect(collapsed.length).toBe(3)
  })

  it('shows task count badges on each column', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: true }),
      createTask({ id: 'c', title: 'Task C', done: false }),
    ]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)

    // Done column (index 3) should have count 2
    expect(columns[3].querySelector('.column-count')?.textContent).toBe('2')
    // Ready column (index 1) should have count 1
    expect(columns[1].querySelector('.column-count')?.textContent).toBe('1')
    // Blocked column (index 0) should have count 0
    expect(columns[0].querySelector('.column-count')?.textContent).toBe('0')
  })

  it('renders tooltip on In Progress column header', () => {
    const { container } = renderKanban([])
    const columns = getColumns(container)
    const ipCol = columns[2] // In Progress is 3rd column
    const title = ipCol.querySelector('.column-title')
    expect(title?.getAttribute('title')).toBe('Tasks with state: in_progress in the .plan file')
  })

  it('handles empty plan without errors', () => {
    const { container } = renderKanban([])
    const columns = getColumns(container)
    expect(columns.length).toBe(4)
    // All columns collapsed since no tasks
    const collapsed = container.querySelectorAll('.column.collapsed')
    expect(collapsed.length).toBe(4)
  })
})
