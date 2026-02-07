<script lang="ts">
import { wouldCreateCycle } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'

interface Props {
  task: Task
  plan: PlanFile
  onSave: (updatedTask: Task) => void
  onClose: () => void
}

let { task, plan, onSave, onClose }: Props = $props()

// Local edit state — captures initial values
// svelte-ignore state_referenced_locally
let title = $state(task.title)
// svelte-ignore state_referenced_locally
let done = $state(task.done ?? false)
// svelte-ignore state_referenced_locally
let taskState = $state((task.state as string | undefined) ?? '')
// svelte-ignore state_referenced_locally
let parent = $state((task.parent as string | undefined) ?? '')
// svelte-ignore state_referenced_locally
let needs = $state<string[]>([...(task.needs ?? [])])
let newDepId = $state('')
let depError = $state('')
// svelte-ignore state_referenced_locally
let startDate = $state((task.start as string | undefined) ?? '')
// svelte-ignore state_referenced_locally
let dueDate = $state((task.due as string | undefined) ?? '')
// svelte-ignore state_referenced_locally
let duration = $state((task.duration as string | undefined) ?? '')
let durationError = $state('')

const DURATION_RE = /^\d+[dhwm]$/

const otherTaskIds = $derived(plan.tasks.filter((t) => t.id !== task.id).map((t) => t.id))

/** Remove a dependency from the needs list. */
function removeDep(depId: string) {
  needs = needs.filter((id) => id !== depId)
}

/** Add a new dependency after cycle check. */
function addDep() {
  const trimmed = newDepId.trim()
  if (trimmed === '' || needs.includes(trimmed)) {
    newDepId = ''
    depError = ''
    return
  }
  if (!plan.tasks.some((t) => t.id === trimmed)) {
    depError = `Task "${trimmed}" does not exist`
    return
  }
  if (wouldCreateCycle(plan.tasks, trimmed, task.id)) {
    depError = 'Adding this dependency would create a cycle'
    return
  }
  needs = [...needs, trimmed]
  newDepId = ''
  depError = ''
}

/** Handle Enter key on the dependency input. */
function handleDepKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    addDep()
  }
}

/** Save updated task fields and close the panel. */
function handleSave() {
  const trimmedTitle = title.trim()
  if (trimmedTitle === '') {
    return
  }
  const trimmedDuration = duration.trim()
  if (trimmedDuration && !DURATION_RE.test(trimmedDuration)) {
    durationError = 'Invalid format — use e.g. 3d, 1w, 2h, 1m'
    return
  }
  durationError = ''
  const trimmedState = taskState.trim()
  const trimmedParent = parent.trim()
  const trimmedStart = startDate.trim()
  const trimmedDue = dueDate.trim()
  onSave({
    ...task,
    title: trimmedTitle,
    done,
    ...(trimmedState ? { state: trimmedState } : { state: undefined }),
    ...(trimmedParent ? { parent: trimmedParent } : { parent: undefined }),
    ...(needs.length > 0 ? { needs } : { needs: undefined }),
    ...(trimmedStart ? { start: trimmedStart } : { start: undefined }),
    ...(trimmedDue ? { due: trimmedDue } : { due: undefined }),
    ...(trimmedDuration ? { duration: trimmedDuration } : { duration: undefined }),
  })
  onClose()
}

/** Cancel edits and close. */
function handleCancel() {
  onClose()
}

/** Handle keyboard shortcuts within the panel. */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div class="detail-backdrop" onclick={handleCancel} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
  <div class="detail-panel" role="dialog" aria-label="Task details" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
    <header class="detail-header">
      <h2 class="detail-title">Task Details</h2>
      <button class="close-btn" onclick={handleCancel} aria-label="Close task details" type="button">×</button>
    </header>

    <div class="detail-body">
      <div class="field">
        <label class="field-label" for="detail-id">ID</label>
        <span id="detail-id" class="field-value">{task.id}</span>
      </div>

      <div class="field">
        <label class="field-label" for="detail-title">Title</label>
        <input
          id="detail-title"
          class="field-input"
          type="text"
          bind:value={title}
        />
      </div>

      <div class="field field-checkbox">
        <label class="field-label" for="detail-done">Done</label>
        <input
          id="detail-done"
          type="checkbox"
          bind:checked={done}
        />
      </div>

      <div class="field">
        <label class="field-label" for="detail-state">State</label>
        <input
          id="detail-state"
          class="field-input"
          type="text"
          bind:value={taskState}
          placeholder="e.g. in_progress"
        />
      </div>

      <div class="field">
        <label class="field-label" for="detail-parent">Parent</label>
        <input
          id="detail-parent"
          class="field-input"
          type="text"
          bind:value={parent}
          placeholder="Parent task ID"
        />
      </div>

      <div class="field">
        <span class="field-label">Dependencies</span>
        {#if needs.length > 0}
          <div class="dep-chips">
            {#each needs as dep}
              <span class="dep-chip">
                {dep}
                <button class="dep-remove" onclick={() => removeDep(dep)} aria-label="Remove dependency {dep}" type="button">×</button>
              </span>
            {/each}
          </div>
        {:else}
          <span class="field-hint">No dependencies</span>
        {/if}
        <div class="dep-add">
          <input
            id="detail-dep-add"
            class="field-input dep-input"
            type="text"
            bind:value={newDepId}
            onkeydown={handleDepKeydown}
            placeholder="Add dependency ID"
            list="dep-suggestions"
          />
          <datalist id="dep-suggestions">
            {#each otherTaskIds as tid}
              <option value={tid}></option>
            {/each}
          </datalist>
          <button class="dep-add-btn" onclick={addDep} type="button">Add</button>
        </div>
        {#if depError}
          <span class="dep-error">{depError}</span>
        {/if}
      </div>

      <div class="field">
        <span class="field-label">Schedule</span>
        <div class="schedule-fields">
          <div class="schedule-field">
            <label class="schedule-label" for="detail-start">Start</label>
            <input
              id="detail-start"
              class="field-input"
              type="date"
              bind:value={startDate}
            />
          </div>
          <div class="schedule-field">
            <label class="schedule-label" for="detail-due">Due</label>
            <input
              id="detail-due"
              class="field-input"
              type="date"
              bind:value={dueDate}
            />
          </div>
          <div class="schedule-field">
            <label class="schedule-label" for="detail-duration">Duration</label>
            <input
              id="detail-duration"
              class="field-input"
              type="text"
              bind:value={duration}
              placeholder="e.g. 3d, 1w"
            />
          </div>
        </div>
        {#if durationError}
          <span class="dep-error">{durationError}</span>
        {/if}
      </div>
    </div>

    <footer class="detail-footer">
      <button class="detail-btn detail-btn-cancel" onclick={handleCancel} type="button">Cancel</button>
      <button class="detail-btn detail-btn-save" onclick={handleSave} type="button">Save</button>
    </footer>
  </div>
</div>

<style>
  .detail-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    z-index: 100;
  }

  .detail-panel {
    width: 360px;
    max-width: 90vw;
    height: 100vh;
    background: var(--color-surface-primary);
    border-left: 1px solid var(--color-border-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border-primary);
    flex-shrink: 0;
  }

  .detail-title {
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

  .detail-body {
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

  .field-checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field-value {
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--color-text-muted);
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

  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-dim);
  }

  .dep-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .dep-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--color-text-secondary);
  }

  .dep-remove {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 0.875rem;
    cursor: pointer;
    line-height: 1;
  }

  .dep-remove:hover {
    color: var(--color-status-blocked);
  }

  .dep-add {
    display: flex;
    gap: 0.375rem;
  }

  .dep-input {
    flex: 1;
  }

  .dep-add-btn {
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-surface-elevated);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .dep-add-btn:hover {
    background: var(--color-surface-elevated-hover);
  }

  .dep-error {
    font-size: 0.75rem;
    color: var(--color-status-blocked);
  }

  .schedule-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .schedule-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .schedule-label {
    font-size: 0.6875rem;
    color: var(--color-text-dim);
  }

  .detail-footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    padding: 1rem;
    border-top: 1px solid var(--color-border-primary);
    flex-shrink: 0;
  }

  .detail-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .detail-btn-cancel {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-secondary);
  }

  .detail-btn-cancel:hover {
    background: var(--color-surface-elevated-hover);
  }

  .detail-btn-save {
    background: var(--color-surface-active);
    border: 1px solid var(--color-border-accent);
    color: var(--color-text-inverse);
  }

  .detail-btn-save:hover {
    opacity: 0.9;
  }
</style>
