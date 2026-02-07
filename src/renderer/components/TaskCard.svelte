<script lang="ts">
import type { Task } from '@shared/types'
import { getContext } from 'svelte'

type TaskStatus = 'done' | 'blocked' | 'ready' | 'in_progress'

interface Props {
  task: Task
  status: TaskStatus
  autoEdit?: boolean
}

let { task, status, autoEdit = false }: Props = $props()

const toggleDone = getContext<((taskId: string) => void) | undefined>('partial:toggleDone')
const updateTitle = getContext<((taskId: string, newTitle: string) => void) | undefined>(
  'partial:updateTitle',
)
const deleteTask = getContext<((taskId: string) => void) | undefined>('partial:deleteTask')
const removeTask = getContext<((taskId: string) => void) | undefined>('partial:removeTask')

const depCount = $derived((task.needs?.length ?? 0) as number)

let editing = $state(false)
let editValue = $state('')

$effect(() => {
  if (autoEdit) {
    startEditing()
  }
})

function handleToggle(event: MouseEvent) {
  event.stopPropagation()
  toggleDone?.(task.id)
}

function startEditing() {
  editValue = task.title
  editing = true
}

function confirmEdit() {
  const trimmed = editValue.trim()
  if (trimmed === '') {
    // Empty title: if this was a new task (autoEdit), remove it entirely
    if (autoEdit) {
      removeTask?.(task.id)
    }
    editing = false
    return
  }
  if (trimmed === task.title) {
    editing = false
    return
  }
  updateTitle?.(task.id, trimmed)
  editing = false
}

function cancelEdit() {
  // If canceling a brand-new task (autoEdit with empty title), remove it
  if (autoEdit && task.title === '') {
    removeTask?.(task.id)
  }
  editing = false
}

function handleTitleDblClick(event: MouseEvent) {
  event.stopPropagation()
  startEditing()
}

function handleDelete(event: MouseEvent) {
  event.stopPropagation()
  deleteTask?.(task.id)
}

function handleCardKeydown(event: KeyboardEvent) {
  if (editing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    toggleDone?.(task.id)
  } else if (event.key === 'F2') {
    event.preventDefault()
    startEditing()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteTask?.(task.id)
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    confirmEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

function handleInputMount(node: HTMLInputElement) {
  node.focus()
  node.select()
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<article class="task-card {status}" tabindex="0" role="listitem" aria-label="{task.title} — {status === 'done' ? 'done' : status === 'ready' ? 'ready' : status === 'blocked' ? 'blocked' : 'in progress'}" onkeydown={handleCardKeydown}>
	<div class="header">
		<button
			class="status-dot"
			onclick={handleToggle}
			aria-label="Mark {task.title} as {task.done ? 'not done' : 'done'}"
			type="button"
		></button>
		{#if editing}
			<input
				class="title-input"
				type="text"
				bind:value={editValue}
				onkeydown={handleInputKeydown}
				onblur={confirmEdit}
				use:handleInputMount
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<h3 class="title" ondblclick={handleTitleDblClick}>{task.title}</h3>
		{/if}
	</div>
	<div class="meta">
		<span class="id">{task.id}</span>
		{#if depCount > 0}
			<span class="deps">{depCount} dep{depCount !== 1 ? 's' : ''}</span>
		{/if}
		<button
			class="delete-btn"
			onclick={handleDelete}
			aria-label="Delete {task.title}"
			type="button"
		>×</button>
	</div>
</article>

<style>
	.task-card {
		border: 1px solid var(--color-border-primary);
		border-radius: 6px;
		padding: 0.625rem 0.75rem;
		background: var(--color-surface-card);
		cursor: default;
		transition: border-color 0.15s;
	}

	.task-card:hover {
		border-color: var(--color-border-hover);
	}

	.task-card:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		appearance: none;
	}

	.title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-primary);
		line-height: 1.3;
	}

	.title-input {
		flex: 1;
		margin: 0;
		padding: 0 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--color-text-primary);
		background: var(--color-surface-primary);
		border: 1px solid var(--color-border-accent);
		border-radius: 3px;
		line-height: 1.3;
		outline: none;
	}

	.meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.375rem;
		padding-left: 1rem;
		font-size: 0.75rem;
		color: var(--color-text-dim);
	}

	.id {
		font-family: monospace;
	}

	.delete-btn {
		margin-left: auto;
		padding: 0;
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--color-text-dim);
		font-size: 0.875rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s, background 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.task-card:hover .delete-btn,
	.task-card:focus-within .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: var(--color-status-blocked-subtle);
		color: var(--color-status-blocked);
	}

	/* State: done */
	.done {
		opacity: 0.75;
		border-color: var(--color-status-done-subtle);
	}

	.done .status-dot {
		background: var(--color-status-done);
	}

	.done .title {
		text-decoration: line-through;
		color: var(--color-text-done);
	}

	/* State: ready */
	.ready {
		border-color: var(--color-status-ready-subtle);
	}

	.ready .status-dot {
		background: var(--color-status-ready);
	}

	/* State: blocked */
	.blocked {
		border-color: var(--color-status-blocked-subtle);
	}

	.blocked .status-dot {
		background: var(--color-status-blocked);
	}

	.blocked .title {
		color: var(--color-text-muted);
	}

	/* State: in_progress */
	.in_progress {
		border-color: var(--color-status-in-progress-subtle);
	}

	.in_progress .status-dot {
		background: var(--color-status-in-progress);
	}
</style>
