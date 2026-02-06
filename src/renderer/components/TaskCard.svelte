<script lang="ts">
import type { Task } from '@shared/types'

type TaskStatus = 'done' | 'blocked' | 'ready' | 'in_progress'

interface Props {
	task: Task
	status: TaskStatus
}

let { task, status }: Props = $props()

const depCount = $derived((task.needs?.length ?? 0) as number)
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article class="task-card {status}" tabindex="0">
	<div class="header">
		<span class="status-dot"></span>
		<h3 class="title">{task.title}</h3>
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
	}

	.title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #e0e0e0;
		line-height: 1.3;
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
