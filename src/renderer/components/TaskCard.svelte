<script lang="ts">
import type { Task } from '@shared/types'
import { getContext } from 'svelte'

type TaskStatus = 'done' | 'blocked' | 'ready' | 'in_progress'

interface Props {
  task: Task
  status: TaskStatus
}

let { task, status }: Props = $props()

const toggleDone = getContext<((taskId: string) => void) | undefined>('partial:toggleDone')
const updateTitle = getContext<((taskId: string, newTitle: string) => void) | undefined>(
  'partial:updateTitle',
)

const depCount = $derived((task.needs?.length ?? 0) as number)

let editing = $state(false)
let editValue = $state('')

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
  if (trimmed === '' || trimmed === task.title) {
    editing = false
    return
  }
  updateTitle?.(task.id, trimmed)
  editing = false
}

function cancelEdit() {
  editing = false
}

function handleTitleDblClick(event: MouseEvent) {
  event.stopPropagation()
  startEditing()
}

function handleCardKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !editing) {
    startEditing()
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
<article class="task-card {status}" tabindex="0" onkeydown={handleCardKeydown}>
	<div class="header">
		<button
			class="status-dot"
			onclick={handleToggle}
			aria-label="Toggle done: {task.title}"
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
	</div>
</article>

<style>
	.task-card {
		border: 1px solid #333;
		border-radius: 6px;
		padding: 0.625rem 0.75rem;
		background: #222244;
		cursor: default;
		transition: border-color 0.15s;
	}

	.task-card:hover {
		border-color: #555;
	}

	.task-card:focus-visible {
		outline: 2px solid #6a6aff;
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
		color: #e0e0e0;
		line-height: 1.3;
	}

	.title-input {
		flex: 1;
		margin: 0;
		padding: 0 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		color: #e0e0e0;
		background: #1a1a2e;
		border: 1px solid #5a5a9a;
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
		color: #888;
	}

	.id {
		font-family: monospace;
	}

	/* State: done */
	.done {
		opacity: 0.6;
		border-color: #2a4a2a;
	}

	.done .status-dot {
		background: #4caf50;
	}

	.done .title {
		text-decoration: line-through;
		color: #999;
	}

	/* State: ready */
	.ready {
		border-color: #2a3a5a;
	}

	.ready .status-dot {
		background: #42a5f5;
	}

	/* State: blocked */
	.blocked {
		border-color: #4a2a2a;
	}

	.blocked .status-dot {
		background: #ef5350;
	}

	.blocked .title {
		color: #aaa;
	}

	/* State: in_progress */
	.in_progress {
		border-color: #4a4a2a;
	}

	.in_progress .status-dot {
		background: #ffa726;
	}
</style>
