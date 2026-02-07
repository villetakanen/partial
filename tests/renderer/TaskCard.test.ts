// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import TaskCard from '../../src/renderer/components/TaskCard.svelte'
import { createTask } from '../helpers'

afterEach(() => {
  cleanup()
})

describe('TaskCard', () => {
  it('renders task title', () => {
    const task = createTask({ id: 'task-1', title: 'My cool task' })
    const { container } = render(TaskCard, { props: { task, status: 'ready' } })
    expect(container.querySelector('.title')?.textContent).toBe('My cool task')
  })

  it('renders task id', () => {
    const task = createTask({ id: 'pbi-042', title: 'Some task' })
    const { container } = render(TaskCard, { props: { task, status: 'ready' } })
    expect(container.querySelector('.id')?.textContent).toBe('pbi-042')
  })

  it('renders dependency count when task has dependencies', () => {
    const task = createTask({ id: 'task-1', title: 'Dep task', needs: ['a', 'b'] })
    const { container } = render(TaskCard, { props: { task, status: 'blocked' } })
    expect(container.querySelector('.deps')?.textContent).toBe('2 deps')
  })

  it('does not render dependency count when task has no dependencies', () => {
    const task = createTask({ id: 'task-1', title: 'No deps' })
    const { container } = render(TaskCard, { props: { task, status: 'ready' } })
    expect(container.querySelector('.deps')).toBeNull()
  })

  it('applies done status class with correct status dot', () => {
    const task = createTask({ id: 'task-1', title: 'Done task', done: true })
    const { container } = render(TaskCard, { props: { task, status: 'done' } })
    const article = container.querySelector('article')
    expect(article?.classList.contains('done')).toBe(true)
    expect(container.querySelector('.status-dot')).toBeTruthy()
  })

  it('applies blocked status class', () => {
    const task = createTask({ id: 'task-1', title: 'Blocked task' })
    const { container } = render(TaskCard, { props: { task, status: 'blocked' } })
    const article = container.querySelector('article')
    expect(article?.classList.contains('blocked')).toBe(true)
  })

  it('applies ready status class', () => {
    const task = createTask({ id: 'task-1', title: 'Ready task' })
    const { container } = render(TaskCard, { props: { task, status: 'ready' } })
    const article = container.querySelector('article')
    expect(article?.classList.contains('ready')).toBe(true)
  })

  it('applies in_progress status class', () => {
    const task = createTask({ id: 'task-1', title: 'WIP task', state: 'in_progress' })
    const { container } = render(TaskCard, { props: { task, status: 'in_progress' } })
    const article = container.querySelector('article')
    expect(article?.classList.contains('in_progress')).toBe(true)
  })

  it('renders status dot element for each state', () => {
    for (const status of ['done', 'blocked', 'ready', 'in_progress'] as const) {
      const task = createTask({ id: `task-${status}`, title: `${status} task` })
      const { container } = render(TaskCard, { props: { task, status } })
      const dot = container.querySelector('.status-dot')
      expect(dot).toBeTruthy()
      cleanup()
    }
  })
})
