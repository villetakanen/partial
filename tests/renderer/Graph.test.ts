// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import GraphView from '../../src/renderer/views/Graph.svelte'
import { buildDAG } from '../../src/shared/dag'
import { createPlan } from '../helpers'

afterEach(() => {
  cleanup()
})

describe('Graph view', () => {
  it('renders empty state for tasks: []', () => {
    const plan = createPlan({ tasks: [] })
    const dag = buildDAG([])
    const { container } = render(GraphView, { props: { plan, dag } })

    expect(container.querySelector('.empty-placeholder')?.textContent).toBe('No tasks to display')
  })

  it('does not render SVG when there are no tasks', () => {
    const plan = createPlan({ tasks: [] })
    const dag = buildDAG([])
    const { container } = render(GraphView, { props: { plan, dag } })

    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders the graph view section', () => {
    const plan = createPlan({ tasks: [] })
    const dag = buildDAG([])
    const { container } = render(GraphView, { props: { plan, dag } })

    expect(container.querySelector('.graph-view')).toBeTruthy()
  })
})
