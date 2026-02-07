<script lang="ts">
import type { PlanFile } from '@shared/types'

interface Props {
  plan: PlanFile
  onSave: (updatedPlan: PlanFile) => void
  onClose: () => void
}

let { plan, onSave, onClose }: Props = $props()

// Local edit state — intentionally captures initial value, not reactive
// svelte-ignore state_referenced_locally
let projectName = $state(plan.project)
// svelte-ignore state_referenced_locally
let description = $state(plan.description ?? '')

/** Save the updated project name and close the panel. */
function handleSave() {
  const trimmed = projectName.trim()
  if (trimmed === '') {
    return
  }
  const desc = description.trim()
  onSave({
    ...plan,
    project: trimmed,
    ...(desc ? { description: desc } : { description: undefined }),
  })
  onClose()
}

/** Cancel edits and close. */
function handleCancel() {
  projectName = plan.project
  onClose()
}

/** Handle keyboard shortcuts within the panel. */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}

/** Handle Enter key on the project name input. */
function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSave()
  }
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div class="settings-backdrop" onclick={handleCancel} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
  <div class="settings-panel" role="dialog" aria-label="Project settings" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
    <header class="settings-header">
      <h2 class="settings-title">Project Settings</h2>
      <button class="close-btn" onclick={handleCancel} aria-label="Close settings" type="button">×</button>
    </header>

    <div class="settings-body">
      <div class="field">
        <label class="field-label" for="settings-project-name">Project Name</label>
        <input
          id="settings-project-name"
          class="field-input"
          type="text"
          bind:value={projectName}
          onkeydown={handleInputKeydown}
        />
      </div>

      <div class="field">
        <label class="field-label" for="settings-description">Description</label>
        <textarea
          id="settings-description"
          class="field-input field-textarea"
          bind:value={description}
          rows="3"
          placeholder="Optional project description"
        ></textarea>
      </div>

      <div class="field">
        <label class="field-label" for="settings-version">Version</label>
        <input
          id="settings-version"
          class="field-input field-input-readonly"
          type="text"
          value={plan.version}
          readonly
          aria-readonly="true"
        />
        <span class="field-hint">Version is read-only</span>
      </div>
    </div>

    <footer class="settings-footer">
      <button class="settings-btn settings-btn-cancel" onclick={handleCancel} type="button">Cancel</button>
      <button class="settings-btn settings-btn-save" onclick={handleSave} type="button">Save</button>
    </footer>
  </div>
</div>

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    z-index: 100;
  }

  .settings-panel {
    width: 320px;
    max-width: 90vw;
    height: 100vh;
    background: var(--color-surface-primary);
    border-left: 1px solid var(--color-border-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border-primary);
    flex-shrink: 0;
  }

  .settings-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close-btn {
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-inverse);
  }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field-input {
    padding: 0.5rem 0.625rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-surface-card);
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s;
  }

  .field-input:focus {
    border-color: var(--color-border-accent);
  }

  .field-textarea {
    resize: vertical;
    min-height: 3rem;
    line-height: 1.4;
  }

  .field-input-readonly {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .field-hint {
    font-size: 0.6875rem;
    color: var(--color-text-dim);
  }

  .settings-footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    padding: 1rem;
    border-top: 1px solid var(--color-border-primary);
    flex-shrink: 0;
  }

  .settings-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .settings-btn-cancel {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-secondary);
  }

  .settings-btn-cancel:hover {
    background: var(--color-surface-elevated-hover);
  }

  .settings-btn-save {
    background: var(--color-surface-active);
    border: 1px solid var(--color-border-accent);
    color: var(--color-text-inverse);
  }

  .settings-btn-save:hover {
    opacity: 0.9;
  }
</style>
