<script lang="ts">
import type { Graph } from '@shared/dag'
import { criticalPath, topologicalSort } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import * as d3 from 'd3'

interface Props {
  plan: PlanFile
  dag: Graph
}

let { plan, dag }: Props = $props()

const ROW_HEIGHT = 36
const BAR_HEIGHT = 24
const BAR_PAD = (ROW_HEIGHT - BAR_HEIGHT) / 2
const MAX_LABEL_WIDTH = 180
const MIN_BAR_WIDTH = 40

let containerEl = $state<HTMLDivElement | null>(null)
let containerWidth = $state(800)

$effect(() => {
  if (!containerEl) return
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidth = entry.contentRect.width
    }
  })
  observer.observe(containerEl)
  return () => observer.disconnect()
})

const sorted = $derived(topologicalSort(dag))
const critPath = $derived(new Set(criticalPath(dag).map((t) => t.id)))

interface BarData {
  task: Task
  x: number
  y: number
  width: number
  isCritical: boolean
}

interface EdgeData {
  x1: number
  y1: number
  x2: number
  y2: number
}

const layout = $derived.by<{
  bars: BarData[]
  edges: EdgeData[]
  svgWidth: number
  svgHeight: number
}>(() => {
  if (sorted.length === 0) {
    return { bars: [], edges: [], svgWidth: 0, svgHeight: 0 }
  }

  const posMap = new Map<string, number>()
  for (let i = 0; i < sorted.length; i++) {
    posMap.set(sorted[i].id, i)
  }

  const colCount = sorted.length
  const labelWidth = Math.min(MAX_LABEL_WIDTH, containerWidth * 0.25)
  const chartWidth = Math.max(containerWidth - labelWidth, colCount * MIN_BAR_WIDTH)
  const xScale = d3.scaleLinear().domain([0, colCount]).range([0, chartWidth])

  const bars: BarData[] = sorted.map((task, i) => ({
    task,
    x: xScale(i),
    y: i * ROW_HEIGHT + BAR_PAD,
    width: xScale(1) - xScale(0) - 4,
    isCritical: critPath.has(task.id),
  }))

  const barMap = new Map<string, BarData>()
  for (const bar of bars) {
    barMap.set(bar.task.id, bar)
  }

  const edges: EdgeData[] = []
  for (const e of dag.edges()) {
    const src = barMap.get(e.v)
    const tgt = barMap.get(e.w)
    if (src && tgt) {
      edges.push({
        x1: src.x + src.width,
        y1: src.y + BAR_HEIGHT / 2,
        x2: tgt.x,
        y2: tgt.y + BAR_HEIGHT / 2,
      })
    }
  }

  const svgWidth = chartWidth
  const svgHeight = sorted.length * ROW_HEIGHT

  return { bars, edges, svgWidth, svgHeight }
})
</script>

<section class="gantt-view" role="region" aria-label="Gantt chart">
	{#if sorted.length === 0}
		<p class="empty-placeholder">No tasks to display</p>
	{:else}
		<div class="gantt-container" bind:this={containerEl}>
			<div class="gantt-scroll">
				<div class="gantt-labels" style="height: {layout.svgHeight}px">
					{#each layout.bars as bar (bar.task.id)}
						<div
							class="label"
							class:done={bar.task.done}
							class:critical={bar.isCritical}
							style="top: {bar.y}px; height: {BAR_HEIGHT}px"
							title={bar.task.title}
						>
							<span class="label-id">{bar.task.id}</span>
							<span class="label-title">{bar.task.title}</span>
						</div>
					{/each}
				</div>
				<div class="gantt-chart">
					<svg
						width={layout.svgWidth}
						height={layout.svgHeight}
						role="img"
						aria-label="Task dependency timeline"
					>
						{#each layout.edges as edge, i}
							<path
								d="M {edge.x1} {edge.y1} C {edge.x1 + 20} {edge.y1}, {edge.x2 - 20} {edge.y2}, {edge.x2} {edge.y2}"
								class="edge"
								aria-hidden="true"
							/>
						{/each}
						{#each layout.bars as bar (bar.task.id)}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<rect
								x={bar.x}
								y={bar.y}
								width={bar.width}
								height={BAR_HEIGHT}
								rx="4"
								class="bar"
								class:done={bar.task.done}
								class:critical={bar.isCritical && !bar.task.done}
								tabindex="0"
								role="listitem"
								aria-label="{bar.task.title}{bar.task.done ? ' (done)' : ''}{bar.isCritical ? ' (critical path)' : ''}"
							/>
						{/each}
					</svg>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.gantt-view {
		padding: 1rem 0;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.empty-placeholder {
		color: var(--color-text-placeholder);
		font-style: italic;
		font-size: 0.8125rem;
		text-align: center;
		padding: 2rem 0;
		margin: 0;
	}

	.gantt-container {
		width: 100%;
		overflow: hidden;
		flex: 1;
		min-height: 0;
	}

	.gantt-scroll {
		display: flex;
		overflow: auto;
	}

	.gantt-labels {
		flex-shrink: 0;
		width: min(180px, 25vw);
		position: relative;
		border-right: 1px solid var(--color-surface-elevated);
	}

	.label {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		overflow: hidden;
		white-space: nowrap;
	}

	.label.done {
		opacity: 0.5;
	}

	.label.critical {
		color: var(--color-status-in-progress);
	}

	.label-id {
		font-family: monospace;
		color: var(--color-text-dim);
		flex-shrink: 0;
	}

	.label-title {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.gantt-chart {
		flex: 1;
		overflow-x: auto;
		overflow-y: hidden;
	}

	svg {
		display: block;
	}

	.edge {
		fill: none;
		stroke: var(--color-border-secondary);
		stroke-width: 1.5;
	}

	.bar {
		fill: var(--color-bar-default);
		cursor: default;
		transition: fill 0.15s;
	}

	.bar:hover {
		fill: var(--color-bar-hover);
	}

	.bar:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.bar.done {
		fill: var(--color-status-done-subtle);
		opacity: 0.5;
	}

	.bar.critical {
		fill: var(--color-bar-critical);
		stroke: var(--color-status-in-progress);
		stroke-width: 2;
	}
</style>
