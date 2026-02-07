<script lang="ts">
import type { Graph } from '@shared/dag'
import { buildDAG } from '@shared/dag'
import type { PartialAPI, PlanUpdatedPayload } from '@shared/ipc'
import type { PlanFile, Task } from '@shared/types'
import { setContext } from 'svelte'
import SettingsPanel from './components/SettingsPanel.svelte'
import TaskDetailPanel from './components/TaskDetailPanel.svelte'
import Welcome from './components/Welcome.svelte'
import Gantt from './views/Gantt.svelte'
import GraphView from './views/Graph.svelte'
import Kanban from './views/Kanban.svelte'

let view = $state<'gantt' | 'kanban' | 'graph'>('gantt')
let showSettings = $state(false)
let detailTask = $state<Task | null>(null)

let plan = $state<PlanFile | null>(null)
let filePath = $state<string | null>(null)

const dag: Graph = $derived(plan ? buildDAG(plan.tasks) : buildDAG([]))

const api = (window as unknown as { api: PartialAPI }).api

$effect(() => {
  api?.onPlanUpdated((payload: PlanUpdatedPayload) => {
    plan = payload.plan
    filePath = payload.filePath
  })
})

/**
 * Provide a done-toggle function to descendant components via Svelte context.
 * TaskCard reads this to handle status-dot clicks.
 */
setContext('partial:toggleDone', (taskId: string) => {
  if (!plan || !filePath) return
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
})

/**
 * Provide a title-update function to descendant components via Svelte context.
 * TaskCard reads this to handle inline title editing.
 */
setContext('partial:updateTitle', (taskId: string, newTitle: string) => {
  if (!plan || !filePath) return
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t)),
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
})

/**
 * Provide an add-task function to descendant components via Svelte context.
 * Creates a new task with a generated ID and saves the plan.
 * Returns the generated task ID so the caller can track it.
 */
setContext('partial:addTask', (): string | null => {
  if (!plan || !filePath) return null
  const id = `task-${Date.now()}`
  const newTask = { id, title: '', done: false }
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: [...plan.tasks, newTask],
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
  return id
})

/**
 * Provide a remove-task function (silent, no confirmation) via Svelte context.
 * Used when canceling a newly created task's title edit (Escape on empty title).
 */
setContext('partial:removeTask', (taskId: string) => {
  if (!plan || !filePath) return
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: plan.tasks.filter((t) => t.id !== taskId),
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
})

/**
 * Provide an open-detail function to descendant components via Svelte context.
 * TaskCard and Graph view read this to open the task detail panel.
 */
setContext('partial:openDetail', (task: Task) => {
  showSettings = false
  detailTask = task
})

/** State for the delete confirmation dialog. */
let deleteConfirm = $state<{ taskId: string; taskTitle: string; dependents: string[] } | null>(null)

/** Execute the actual deletion: remove task and clean needs arrays. */
function executeDelete(taskId: string) {
  if (!plan || !filePath) return
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: plan.tasks
      .filter((t) => t.id !== taskId)
      .map((t) => {
        const needsFields = ['needs', 'needs_fs', 'needs_ss', 'needs_ff', 'needs_sf'] as const
        let changed = false
        const updated = { ...t }
        for (const field of needsFields) {
          const arr = updated[field]
          if (Array.isArray(arr) && arr.includes(taskId)) {
            const filtered = arr.filter((id: string) => id !== taskId)
            if (filtered.length > 0) {
              updated[field] = filtered
            } else {
              delete updated[field]
            }
            changed = true
          }
        }
        return changed ? updated : t
      }),
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
}

/**
 * Provide a delete function to descendant components via Svelte context.
 * If the task has dependents, opens a confirmation dialog. Otherwise deletes immediately.
 */
setContext('partial:deleteTask', (taskId: string) => {
  if (!plan || !filePath) return
  const task = plan.tasks.find((t) => t.id === taskId)
  if (!task) return

  const dependents = dag.successors(taskId) ?? []
  if (dependents.length === 0) {
    executeDelete(taskId)
  } else {
    deleteConfirm = { taskId, taskTitle: task.title, dependents: dependents as string[] }
  }
})

/** Confirm deletion from the dialog. */
function confirmDelete() {
  if (!deleteConfirm) return
  executeDelete(deleteConfirm.taskId)
  deleteConfirm = null
}

/** Cancel deletion. */
function cancelDelete() {
  deleteConfirm = null
}

/** Save updated plan from settings panel. */
function handleSettingsSave(updatedPlan: PlanFile) {
  if (!filePath) return
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
}

/** Save updated task from detail panel. */
function handleDetailSave(updatedTask: Task) {
  if (!plan || !filePath) return
  const updatedPlan: PlanFile = {
    ...plan,
    tasks: plan.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
  }
  plan = updatedPlan
  api?.savePlan({ filePath, plan: updatedPlan })
}
</script>

<main>
	{#if plan}
		<header>
			<h1>Partial</h1>
			<nav aria-label="View navigation">
				<button class:active={view === 'gantt'} onclick={() => (view = 'gantt')} aria-label="Gantt chart view" aria-pressed={view === 'gantt'}>Gantt</button>
				<button class:active={view === 'kanban'} onclick={() => (view = 'kanban')} aria-label="Kanban board view" aria-pressed={view === 'kanban'}>Kanban</button>
				<button class:active={view === 'graph'} onclick={() => (view = 'graph')} aria-label="Dependency graph view" aria-pressed={view === 'graph'}>Graph</button>
			</nav>
			{#if filePath}
				<span class="plan-status" aria-live="polite">{filePath}</span>
			{/if}
			<button class="settings-btn" onclick={() => { detailTask = null; showSettings = true }} aria-label="Project settings" type="button">
				<svg class="settings-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473a6.5 6.5 0 011.345.777l1.42-.47a1 1 0 011.12.37l.68 1.177a1 1 0 01-.14 1.173l-1.126 1.003a6.5 6.5 0 010 1.554l1.126 1.003a1 1 0 01.14 1.173l-.68 1.177a1 1 0 01-1.12.37l-1.42-.47a6.5 6.5 0 01-1.345.777l-.295 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.5 6.5 0 01-1.345-.777l-1.42.47a1 1 0 01-1.12-.37l-.68-1.177a1 1 0 01.14-1.173l1.126-1.003a6.5 6.5 0 010-1.554L3.62 5.63a1 1 0 01-.14-1.173l.68-1.177a1 1 0 011.12-.37l1.42.47a6.5 6.5 0 011.345-.777L8.34 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
				</svg>
			</button>
		</header>

		<section class="view-container">
			{#if view === 'gantt'}
				<Gantt plan={plan} {dag} />
			{:else if view === 'kanban'}
				<Kanban plan={plan} {dag} />
			{:else}
				<GraphView plan={plan} {dag} />
			{/if}
		</section>
	{:else}
		<Welcome />
	{/if}

	{#if showSettings && plan}
		<SettingsPanel {plan} onSave={handleSettingsSave} onClose={() => (showSettings = false)} />
	{/if}

	{#if detailTask && plan}
		<TaskDetailPanel task={detailTask} {plan} onSave={handleDetailSave} onClose={() => (detailTask = null)} />
	{/if}

	{#if deleteConfirm}
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
		<div class="dialog-backdrop" onclick={cancelDelete} onkeydown={(e) => { if (e.key === 'Escape') cancelDelete() }}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
			<div class="dialog" role="alertdialog" aria-label="Confirm task deletion" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') cancelDelete() }}>
				<h2 class="dialog-title">Delete task?</h2>
				<p class="dialog-text">
					<strong>{deleteConfirm.taskTitle}</strong> ({deleteConfirm.taskId}) is referenced by:
				</p>
				<ul class="dialog-list">
					{#each deleteConfirm.dependents as dep}
						<li>{dep}</li>
					{/each}
				</ul>
				<p class="dialog-text">Deleting it will remove it from their dependencies.</p>
				<div class="dialog-actions">
					<button class="dialog-btn dialog-btn-cancel" onclick={cancelDelete} type="button">Cancel</button>
					<button class="dialog-btn dialog-btn-delete" onclick={confirmDelete} type="button">Delete</button>
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, -apple-system, sans-serif;
		color: var(--color-text-primary);
		background: var(--color-surface-primary);
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		gap: 2rem;
		border-bottom: 1px solid var(--color-border-primary);
		padding: 1rem 1rem 0.75rem;
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	nav {
		display: flex;
		gap: 0.25rem;
	}

	button {
		background: transparent;
		border: 1px solid var(--color-border-secondary);
		color: var(--color-text-muted);
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	button:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-inverse);
	}

	button.active {
		background: var(--color-surface-active);
		color: var(--color-text-inverse);
		border-color: var(--color-border-accent);
	}

	.settings-btn {
		margin-left: 0;
		padding: 0.375rem;
		border: 1px solid var(--color-border-secondary);
		border-radius: 4px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.settings-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-inverse);
	}

	.settings-icon {
		width: 1rem;
		height: 1rem;
	}

	.plan-status {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--color-text-dim);
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.view-container {
		padding: 1rem;
		flex: 1;
		overflow: auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.dialog-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: var(--color-surface-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: 8px;
		padding: 1.25rem;
		max-width: 400px;
		width: 90%;
	}

	.dialog-title {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.dialog-text {
		margin: 0 0 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.dialog-list {
		margin: 0 0 0.75rem;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
		font-family: monospace;
		color: var(--color-text-secondary);
	}

	.dialog-list li {
		margin: 0.125rem 0;
	}

	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.dialog-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.dialog-btn-cancel {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-secondary);
		color: var(--color-text-secondary);
	}

	.dialog-btn-cancel:hover {
		background: var(--color-surface-elevated-hover);
	}

	.dialog-btn-delete {
		background: var(--color-status-blocked);
		border: 1px solid var(--color-status-blocked);
		color: white;
	}

	.dialog-btn-delete:hover {
		opacity: 0.9;
	}
</style>
