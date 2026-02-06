<script lang="ts">
import type { Graph } from '@shared/dag'
import { buildDAG } from '@shared/dag'
import type { PartialAPI, PlanUpdatedPayload } from '@shared/ipc'
import type { PlanFile } from '@shared/types'
import Welcome from './components/Welcome.svelte'
import Gantt from './views/Gantt.svelte'
import GraphView from './views/Graph.svelte'
import Kanban from './views/Kanban.svelte'

let view = $state<'gantt' | 'kanban' | 'graph'>('gantt')

let plan = $state<PlanFile | null>(null)

const dag: Graph = $derived(plan ? buildDAG(plan.tasks) : buildDAG([]))

const api = (window as unknown as { api: PartialAPI }).api

$effect(() => {
  api?.onPlanUpdated((payload: PlanUpdatedPayload) => {
    plan = payload.plan
  })
})
</script>

<main>
	{#if plan}
		<header>
			<h1>Partial</h1>
			<nav>
				<button class:active={view === 'gantt'} onclick={() => (view = 'gantt')}>Gantt</button>
				<button class:active={view === 'kanban'} onclick={() => (view = 'kanban')}>Kanban</button>
				<button class:active={view === 'graph'} onclick={() => (view = 'graph')}>Graph</button>
			</nav>
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
		width: 100%;
		padding: 1rem;
		color: #e0e0e0;
		background: #1a1a2e;
		min-height: 100vh;
	}

	header {
		display: flex;
		align-items: center;
		gap: 2rem;
		border-bottom: 1px solid #333;
		padding-bottom: 0.75rem;
		margin-bottom: 1rem;
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
		border: 1px solid #444;
		color: #aaa;
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	button:hover {
		background: #2a2a4a;
		color: #fff;
	}

	button.active {
		background: #3a3a6a;
		color: #fff;
		border-color: #5a5a9a;
	}

	.view-container {
		padding: 1rem 0;
	}
</style>
