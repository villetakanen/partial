// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsPanel from '../../src/renderer/components/SettingsPanel.svelte'
import type { PlanFile } from '../../src/shared/types'
import { createPlan } from '../helpers'

afterEach(() => {
  cleanup()
})

function renderSettings(overrides?: {
  plan?: PlanFile
  onSave?: (p: PlanFile) => void
  onClose?: () => void
}) {
  const plan = overrides?.plan ?? createPlan({ project: 'My Project' })
  const onSave = overrides?.onSave ?? vi.fn()
  const onClose = overrides?.onClose ?? vi.fn()
  const result = render(SettingsPanel, { props: { plan, onSave, onClose } })
  return { ...result, onSave, onClose, plan }
}

describe('SettingsPanel', () => {
  it('save dispatches onSave with updated project name', async () => {
    const onSave = vi.fn()
    const { container } = renderSettings({ onSave })

    const input = container.querySelector<HTMLInputElement>('#settings-project-name')
    expect(input).not.toBeNull()
    fireEvent.input(input as HTMLInputElement, { target: { value: 'New Name' } })

    const saveBtn = container.querySelector<HTMLButtonElement>('.settings-btn-save')
    expect(saveBtn).not.toBeNull()
    await fireEvent.click(saveBtn as HTMLButtonElement)

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].project).toBe('New Name')
  })

  it('save with unchanged name still dispatches onSave', async () => {
    const onSave = vi.fn()
    const { container } = renderSettings({ onSave })

    const saveBtn = container.querySelector<HTMLButtonElement>('.settings-btn-save')
    expect(saveBtn).not.toBeNull()
    await fireEvent.click(saveBtn as HTMLButtonElement)

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].project).toBe('My Project')
  })

  it('empty name does not dispatch onSave', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const { container } = renderSettings({ onSave, onClose })

    const input = container.querySelector<HTMLInputElement>('#settings-project-name')
    expect(input).not.toBeNull()
    fireEvent.input(input as HTMLInputElement, { target: { value: '   ' } })

    const saveBtn = container.querySelector<HTMLButtonElement>('.settings-btn-save')
    expect(saveBtn).not.toBeNull()
    await fireEvent.click(saveBtn as HTMLButtonElement)

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancel dispatches onClose without onSave', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const { container } = renderSettings({ onSave, onClose })

    const cancelBtn = container.querySelector<HTMLButtonElement>('.settings-btn-cancel')
    expect(cancelBtn).not.toBeNull()
    await fireEvent.click(cancelBtn as HTMLButtonElement)

    expect(onClose).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Escape key triggers cancel', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const { container } = renderSettings({ onSave, onClose })

    const panel = container.querySelector<HTMLElement>('.settings-panel')
    expect(panel).not.toBeNull()
    await fireEvent.keyDown(panel as HTMLElement, { key: 'Escape' })

    // Event bubbles from panel to backdrop, both call handleCancel → onClose
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
