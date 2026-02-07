<script lang="ts">
import type { Graph } from '@shared/dag'
import { buildDAG } from '@shared/dag'
import type { PartialAPI, PlanUpdatedPayload } from '@shared/ipc'
import type { PlanFile } from '@shared/types'
import { setContext } from 'svelte'
import Welcome from './components/Welcome.svelte'
import Gantt from './views/Gantt.svelte'
import GraphView from './views/Graph.svelte'
import Kanban from './views/Kanban.svelte'

let view = $state<'gantt' | 'kanban' | 'graph'>('gantt')

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
</style>
