// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/App.svelte'

beforeEach(() => {
  // Mock the window.api object that the preload script exposes
  ;(window as unknown as { api: unknown }).api = {
    openFile: vi.fn(),
    showOpenDialog: vi.fn(),
    savePlan: vi.fn(),
    onPlanUpdated: vi.fn(),
    onPlanDeleted: vi.fn(),
    onPlanError: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders Welcome screen when no plan is loaded', () => {
    const { container } = render(App)

    // Welcome component renders "Partial" heading and "Open Plan File" button
    expect(container.querySelector('h2')?.textContent).toBe('Partial')
    expect(container.querySelector('button')?.textContent).toBe('Open Plan File')
  })

  it('does not show view navigation when no plan is loaded', () => {
    const { container } = render(App)

    // No nav bar buttons (Gantt, Kanban, Graph) should be present
    const nav = container.querySelector('nav')
    expect(nav).toBeNull()
  })

  it('registers onPlanUpdated callback on mount', () => {
    render(App)

    const api = (window as unknown as { api: { onPlanUpdated: ReturnType<typeof vi.fn> } }).api
    expect(api.onPlanUpdated).toHaveBeenCalledOnce()
  })
})
