<script lang="ts">
import type { Graph } from '@shared/dag'
import type { PlanFile } from '@shared/types'

interface Props {
	plan: PlanFile
	dag: Graph
}

let { plan, dag }: Props = $props()

const taskCount = $derived(plan.tasks.length)
const edgeCount = $derived(dag.edgeCount())
</script>

<section class="graph-view">
	<p class="placeholder">Graph view — {taskCount} tasks, {edgeCount} dependencies</p>
</section>

<style>
	.graph-view {
		padding: 1rem 0;
	}

	.placeholder {
		color: #888;
		font-style: italic;
	}
</style>
