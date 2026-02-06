<script lang="ts">
import type { Graph } from '@shared/dag'
import { getUnblockedTasks } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import TaskCard from '../components/TaskCard.svelte'

interface Props {
  plan: PlanFile
  dag: Graph
}

let { plan, dag }: Props = $props()

type TaskStatus = 'done' | 'blocked' | 'ready' | 'in_progress'

interface Column {
  key: TaskStatus
  label: string
  tasks: Task[]
  tooltip?: string
}

const columns = $derived.by<Column[]>(() => {
  const done: Task[] = []
  const inProgress: Task[] = []
  const ready: Task[] = []
  const blocked: Task[] = []

  const unblockedSet = new Set(getUnblockedTasks(dag, plan.tasks).map((t) => t.id))

  for (const task of plan.tasks) {
    if (task.done) {
      done.push(task)
    } else if (task.state === 'in_progress' && unblockedSet.has(task.id)) {
      inProgress.push(task)
    } else if (unblockedSet.has(task.id)) {
      ready.push(task)
    } else {
      blocked.push(task)
    }
  }

  return [
    { key: 'blocked', label: 'Blocked', tasks: blocked },
    { key: 'ready', label: 'Ready', tasks: ready },
    {
      key: 'in_progress',
      label: 'In Progress',
      tasks: inProgress,
      tooltip: 'Tasks with state: in_progress in the .plan file',
    },
    { key: 'done', label: 'Done', tasks: done },
  ]
})
</script>

<section class="kanban-view" role="region" aria-label="Kanban board">
	{#each columns as column (column.key)}
		<div
			class="column"
			class:collapsed={column.tasks.length === 0}
			role="group"
			aria-label="{column.label} column"
		>
			<header class="column-header">
				{#if column.tooltip}
					<h2 class="column-title" title={column.tooltip}>{column.label}</h2>
				{:else}
					<h2 class="column-title">{column.label}</h2>
				{/if}
				<span class="column-count">{column.tasks.length}</span>
			</header>
			{#if column.tasks.length > 0}
				<div class="column-body">
					{#each column.tasks as task (task.id)}
						<TaskCard {task} status={column.key} />
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</section>

<style>
	.kanban-view {
		display: flex;
		gap: 1rem;
		padding: 1rem 0;
		overflow-x: auto;
		min-height: 200px;
	}

	.column {
		flex: 1 1 0;
		min-width: 200px;
		display: flex;
		flex-direction: column;
		background: #1a1a2e;
		border-radius: 8px;
		border: 1px solid #2a2a3e;
		transition:
			flex 0.2s ease,
			min-width 0.2s ease,
			opacity 0.2s ease;
	}

	.column.collapsed {
		flex: 0 0 48px;
		min-width: 48px;
		opacity: 0.5;
		overflow: hidden;
	}

	.column.collapsed:hover,
	.column.collapsed:focus-within {
		flex: 1 1 0;
		min-width: 200px;
		opacity: 1;
	}

	.column.collapsed .column-header {
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 0.25rem;
		align-items: center;
	}

	.column.collapsed:hover .column-header,
	.column.collapsed:focus-within .column-header {
		flex-direction: row;
		padding: 0.75rem 1rem;
	}

	.column.collapsed .column-title {
		writing-mode: vertical-lr;
		font-size: 0.75rem;
	}

	.column.collapsed:hover .column-title,
	.column.collapsed:focus-within .column-title {
		writing-mode: horizontal-tb;
		font-size: 0.875rem;
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #2a2a3e;
	}

	.column-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #ccc;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.column-count {
		font-size: 0.75rem;
		color: #888;
		background: #2a2a3e;
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.column-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		flex: 1;
	}
</style>
