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
 * Get the column elements from the rendered Kanban board.
 */
function getColumns(container: HTMLElement) {
  return container.querySelectorAll<HTMLDivElement>('.column')
}

describe('Kanban', () => {
  it('renders three column headers when no in_progress tasks', () => {
    const { container } = renderKanban([])
    const headers = container.querySelectorAll('.column-title')
    const labels = Array.from(headers).map((h) => h.textContent)
    expect(labels).toEqual(['Blocked', 'Ready', 'Done'])
  })

  it('renders four column headers when in_progress tasks exist', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'WIP task', done: false, state: 'in_progress' }),
    ]
    const { container } = renderKanban(tasks)
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

    // Column order without in_progress: Blocked, Ready, Done
    const blockedCol = columns[0]
    const readyCol = columns[1]
    const doneCol = columns[2]

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
    // With in_progress tasks: Blocked, Ready, In Progress, Done
    const ipCol = columns[2]

    expect(ipCol.textContent).toContain('WIP task')
  })

  it('collapses empty columns (except Ready which has Add button)', () => {
    // Only done tasks — Blocked should be collapsed; Ready stays open for Add button; no In Progress column
    const tasks: Task[] = [createTask({ id: 'a', title: 'Done task', done: true })]

    const { container } = renderKanban(tasks)
    const collapsed = container.querySelectorAll('.column.collapsed')

    // 1 collapsed (blocked is empty); Ready stays open; In Progress hidden; Done has task
    expect(collapsed.length).toBe(1)
  })

  it('does not collapse columns that have tasks', () => {
    const tasks: Task[] = [createTask({ id: 'a', title: 'Ready task', done: false })]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)
    const readyCol = columns[1] // Ready is 2nd column

    // Ready column should not be collapsed since it has a task
    expect(readyCol.classList.contains('collapsed')).toBe(false)

    // Blocked and Done should be collapsed; In Progress is hidden
    const collapsed = container.querySelectorAll('.column.collapsed')
    expect(collapsed.length).toBe(2)
  })

  it('shows task count badges on each column', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', title: 'Task A', done: true }),
      createTask({ id: 'b', title: 'Task B', done: true }),
      createTask({ id: 'c', title: 'Task C', done: false }),
    ]

    const { container } = renderKanban(tasks)
    const columns = getColumns(container)

    // Without in_progress: columns are Blocked, Ready, Done
    // Done column (index 2) should have count 2
    expect(columns[2].querySelector('.column-count')?.textContent).toBe('2')
    // Ready column (index 1) should have count 1
    expect(columns[1].querySelector('.column-count')?.textContent).toBe('1')
    // Blocked column (index 0) should have count 0
    expect(columns[0].querySelector('.column-count')?.textContent).toBe('0')
  })

  it('renders tooltip on In Progress column header when present', () => {
    const tasks: Task[] = [createTask({ id: 'a', title: 'WIP', done: false, state: 'in_progress' })]
    const { container } = renderKanban(tasks)
    const columns = getColumns(container)
    const ipCol = columns[2] // In Progress is 3rd column when present
    const title = ipCol.querySelector('.column-title')
    expect(title?.getAttribute('title')).toBe('Tasks with state: in_progress in the .plan file')
  })

  it('renders Add Task button in Ready column', () => {
    const { container } = renderKanban([])
    const columns = getColumns(container)
    const readyCol = columns[1] // Ready is 2nd column
    const addBtn = readyCol.querySelector('.add-task-btn')
    expect(addBtn).not.toBeNull()
    expect(addBtn?.textContent).toBe('+')
    expect(addBtn?.getAttribute('aria-label')).toBe('Add new task')
  })

  it('does not render Add Task button in non-Ready columns', () => {
    const tasks: Task[] = [createTask({ id: 'a', title: 'WIP', done: false, state: 'in_progress' })]
    const { container } = renderKanban(tasks)
    const columns = getColumns(container)
    // With in_progress: Blocked(0), Ready(1), InProgress(2), Done(3)
    expect(columns[0].querySelector('.add-task-btn')).toBeNull()
    expect(columns[2].querySelector('.add-task-btn')).toBeNull()
    expect(columns[3].querySelector('.add-task-btn')).toBeNull()
  })

  it('handles empty plan without errors', () => {
    const { container } = renderKanban([])
    const columns = getColumns(container)
    // 3 columns (no In Progress when empty)
    expect(columns.length).toBe(3)
    // 2 collapsed (blocked, done); Ready stays open for Add button
    const collapsed = container.querySelectorAll('.column.collapsed')
    expect(collapsed.length).toBe(2)
  })
})
