<script lang="ts">
import type { Graph } from '@shared/dag'
import { getUnblockedTasks } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import { getContext } from 'svelte'
import TaskCard from '../components/TaskCard.svelte'

interface Props {
  plan: PlanFile
  dag: Graph
}

let { plan, dag }: Props = $props()

const addTask = getContext<(() => string | null) | undefined>('partial:addTask')

let boardEl = $state<HTMLElement | null>(null)
let newTaskId = $state<string | null>(null)

/** Creates a new task and tracks its ID so the card auto-enters edit mode. */
function handleAddTask() {
  const id = addTask?.() ?? null
  newTaskId = id
}

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

/** Returns all focusable task-card elements within a column element. */
function getCardsInColumn(columnEl: Element): HTMLElement[] {
  return Array.from(columnEl.querySelectorAll<HTMLElement>('.task-card'))
}

/** Handles arrow-key navigation between cards and columns. */
function handleBoardKeydown(event: KeyboardEvent) {
  if (!boardEl) return
  const target = event.target as HTMLElement
  if (!target.classList.contains('task-card')) return

  const columnEls = Array.from(boardEl.querySelectorAll<HTMLElement>('.column'))
  const currentCol = target.closest('.column')
  if (!currentCol) return

  const colIdx = columnEls.indexOf(currentCol as HTMLElement)
  const cards = getCardsInColumn(currentCol)
  const cardIdx = cards.indexOf(target)

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      const next = cards[cardIdx + 1]
      next?.focus()
      break
    }
    case 'ArrowUp': {
      event.preventDefault()
      const prev = cards[cardIdx - 1]
      prev?.focus()
      break
    }
    case 'ArrowRight': {
      event.preventDefault()
      for (let i = colIdx + 1; i < columnEls.length; i++) {
        const nextCards = getCardsInColumn(columnEls[i])
        if (nextCards.length > 0) {
          nextCards[Math.min(cardIdx, nextCards.length - 1)].focus()
          break
        }
      }
      break
    }
    case 'ArrowLeft': {
      event.preventDefault()
      for (let i = colIdx - 1; i >= 0; i--) {
        const prevCards = getCardsInColumn(columnEls[i])
        if (prevCards.length > 0) {
          prevCards[Math.min(cardIdx, prevCards.length - 1)].focus()
          break
        }
      }
      break
    }
  }
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_redundant_roles -->
<section class="kanban-view" role="region" aria-label="Kanban board" bind:this={boardEl} onkeydown={handleBoardKeydown}>
	{#each columns as column (column.key)}
		<div
			class="column"
			class:collapsed={column.tasks.length === 0 && column.key !== 'ready'}
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
				{#if column.key === 'ready'}
					<button class="add-task-btn" onclick={handleAddTask} aria-label="Add new task" type="button">+</button>
				{/if}
			</header>
			{#if column.tasks.length > 0 || (column.key === 'ready' && newTaskId)}
				<div class="column-body" role="list" aria-label="{column.label} tasks">
					{#each column.tasks as task (task.id)}
						<TaskCard {task} status={column.key} autoEdit={task.id === newTaskId} />
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
		min-height: 0;
		flex: 1;
	}

	.column {
		flex: 1 1 0;
		min-width: min(200px, 40vw);
		display: flex;
		flex-direction: column;
		background: var(--color-surface-primary);
		border-radius: 8px;
		border: 1px solid var(--color-surface-elevated);
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
		border-bottom: 1px solid var(--color-surface-elevated);
		gap: 0.5rem;
	}

	.column-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.column-count {
		font-size: 0.75rem;
		color: var(--color-text-dim);
		background: var(--color-surface-elevated);
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.add-task-btn {
		margin-left: auto;
		padding: 0;
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid var(--color-border-secondary);
		border-radius: 4px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s, background 0.15s, border-color 0.15s;
	}

	.add-task-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-inverse);
		border-color: var(--color-border-accent);
	}

	.column-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		flex: 1;
	}
</style>
