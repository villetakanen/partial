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
const ONE_DAY_MS = 86_400_000

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

/** Check if any task in the sorted list has a parseable start or due date. */
const hasTimeData = $derived(
  sorted.some(
    (t) => parseDate(t.start as string | undefined) || parseDate(t.due as string | undefined),
  ),
)

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

interface TimeTickData {
  x: number
  label: string
}

/** Safely parse an ISO 8601 date string (YYYY-MM-DD) into a Date, or return null. */
function parseDate(value: string | undefined): Date | null {
  if (!value || typeof value !== 'string') return null
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value)
  if (!match) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** Compute ordinal (dependency-order) layout — the existing behavior. */
function computeOrdinalLayout(
  tasks: Task[],
  labelWidth: number,
): {
  bars: BarData[]
  edges: EdgeData[]
  svgWidth: number
  svgHeight: number
  timeTicks: TimeTickData[]
} {
  if (tasks.length === 0) {
    return { bars: [], edges: [], svgWidth: 0, svgHeight: 0, timeTicks: [] }
  }

  const colCount = tasks.length
  const chartWidth = Math.max(containerWidth - labelWidth, colCount * MIN_BAR_WIDTH)
  const xScale = d3.scaleLinear().domain([0, colCount]).range([0, chartWidth])

  const bars: BarData[] = tasks.map((task, i) => ({
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

  return { bars, edges, svgWidth: chartWidth, svgHeight: tasks.length * ROW_HEIGHT, timeTicks: [] }
}

/** Compute time-based layout using d3.scaleTime. */
function computeTimeLayout(
  tasks: Task[],
  labelWidth: number,
): {
  bars: BarData[]
  edges: EdgeData[]
  svgWidth: number
  svgHeight: number
  timeTicks: TimeTickData[]
} {
  if (tasks.length === 0) {
    return { bars: [], edges: [], svgWidth: 0, svgHeight: 0, timeTicks: [] }
  }

  // Collect all dates to determine the time domain
  let minDate = Number.POSITIVE_INFINITY
  let maxDate = Number.NEGATIVE_INFINITY

  for (const task of tasks) {
    const s = parseDate(task.start as string | undefined)
    const d = parseDate(task.due as string | undefined)
    if (s) {
      minDate = Math.min(minDate, s.getTime())
      maxDate = Math.max(maxDate, s.getTime() + ONE_DAY_MS)
    }
    if (d) {
      minDate = Math.min(minDate, d.getTime())
      maxDate = Math.max(maxDate, d.getTime() + ONE_DAY_MS)
    }
  }

  // Add padding: 1 day before and after
  const domainStart = new Date(minDate - ONE_DAY_MS)
  const domainEnd = new Date(maxDate + ONE_DAY_MS)

  const chartWidth = Math.max(containerWidth - labelWidth, tasks.length * MIN_BAR_WIDTH)
  const timeScale = d3.scaleTime().domain([domainStart, domainEnd]).range([0, chartWidth])

  // Generate time ticks for the axis
  const dayInterval = d3.timeDay.every(1)
  const ticks = dayInterval ? timeScale.ticks(dayInterval) : timeScale.ticks(7)
  const timeTicks: TimeTickData[] = ticks.map((d) => ({
    x: timeScale(d),
    label: d3.timeFormat('%b %d')(d),
  }))

  const bars: BarData[] = tasks.map((task, i) => {
    const startDate = parseDate(task.start as string | undefined)
    const dueDate = parseDate(task.due as string | undefined)

    let x: number
    let width: number

    if (startDate && dueDate) {
      x = timeScale(startDate)
      width = Math.max(timeScale(dueDate) - x, 8)
    } else if (startDate) {
      x = timeScale(startDate)
      width = Math.max(timeScale(new Date(startDate.getTime() + ONE_DAY_MS)) - x, 8)
    } else if (dueDate) {
      x = timeScale(new Date(dueDate.getTime() - ONE_DAY_MS))
      width = Math.max(timeScale(dueDate) - x, 8)
    } else {
      // Undated task: place at ordinal position scaled into the time range
      const fraction = (i + 0.5) / tasks.length
      const pos = timeScale(
        new Date(domainStart.getTime() + fraction * (domainEnd.getTime() - domainStart.getTime())),
      )
      x = pos - MIN_BAR_WIDTH / 2
      width = MIN_BAR_WIDTH
    }

    return {
      task,
      x,
      y: i * ROW_HEIGHT + BAR_PAD,
      width,
      isCritical: critPath.has(task.id),
    }
  })

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

  return { bars, edges, svgWidth: chartWidth, svgHeight: tasks.length * ROW_HEIGHT, timeTicks }
}

const layout = $derived.by<{
  bars: BarData[]
  edges: EdgeData[]
  svgWidth: number
  svgHeight: number
  timeTicks: TimeTickData[]
}>(() => {
  const labelWidth = Math.min(MAX_LABEL_WIDTH, containerWidth * 0.25)
  if (hasTimeData) {
    return computeTimeLayout(sorted, labelWidth)
  }
  return computeOrdinalLayout(sorted, labelWidth)
})

/** Handles arrow-key navigation between Gantt bars. */
function handleGanttKeydown(event: KeyboardEvent) {
  const target = event.target as Element
  if (target.tagName !== 'rect' || !target.classList.contains('bar')) return

  const svg = target.closest('svg')
  if (!svg) return

  const bars = Array.from(svg.querySelectorAll<SVGRectElement>('rect.bar'))
  const idx = bars.indexOf(target as SVGRectElement)
  if (idx === -1) return

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      bars[idx + 1]?.focus()
      break
    }
    case 'ArrowUp': {
      event.preventDefault()
      bars[idx - 1]?.focus()
      break
    }
  }
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_redundant_roles -->
<section class="gantt-view" role="region" aria-label="Gantt chart" onkeydown={handleGanttKeydown}>
	{#if sorted.length === 0}
		<p class="empty-placeholder">No tasks to display</p>
	{:else}
		<div class="gantt-container" bind:this={containerEl}>
			<div class="gantt-scroll">
				<div class="gantt-labels" style="height: {layout.svgHeight + (layout.timeTicks.length > 0 ? 24 : 0)}px">
					{#if layout.timeTicks.length > 0}
						<div class="label-axis-spacer" style="height: 24px"></div>
					{/if}
					{#each layout.bars as bar (bar.task.id)}
						<div
							class="label"
							class:done={bar.task.done}
							class:critical={bar.isCritical}
							style="top: {bar.y + (layout.timeTicks.length > 0 ? 24 : 0)}px; height: {BAR_HEIGHT}px"
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
						height={layout.svgHeight + (layout.timeTicks.length > 0 ? 24 : 0)}
						aria-label="Task dependency timeline"
					>
						{#if layout.timeTicks.length > 0}
							<g class="time-axis" aria-hidden="true">
								{#each layout.timeTicks as tick}
									<line x1={tick.x} y1="0" x2={tick.x} y2={layout.svgHeight + 24} class="tick-line" />
									<text x={tick.x + 3} y="16" class="tick-label">{tick.label}</text>
								{/each}
							</g>
							<g transform="translate(0, 24)">
								{#each layout.edges as edge}
									<path
										d="M {edge.x1} {edge.y1} C {edge.x1 + 20} {edge.y1}, {edge.x2 - 20} {edge.y2}, {edge.x2} {edge.y2}"
										class="edge"
										aria-hidden="true"
									/>
								{/each}
								<g role="list" aria-label="Task bars">
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
								</g>
							</g>
						{:else}
							{#each layout.edges as edge}
								<path
									d="M {edge.x1} {edge.y1} C {edge.x1 + 20} {edge.y1}, {edge.x2 - 20} {edge.y2}, {edge.x2} {edge.y2}"
									class="edge"
									aria-hidden="true"
								/>
							{/each}
							<g role="list" aria-label="Task bars">
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
							</g>
						{/if}
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

	.label-axis-spacer {
		border-bottom: 1px solid var(--color-surface-elevated);
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
		opacity: 0.7;
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

	.tick-line {
		stroke: var(--color-surface-elevated);
		stroke-width: 1;
		stroke-dasharray: 4 4;
	}

	.tick-label {
		font-size: 0.625rem;
		fill: var(--color-text-dim);
		font-family: monospace;
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
		opacity: 0.7;
	}

	.bar.critical {
		fill: var(--color-bar-critical);
		stroke: var(--color-status-in-progress);
		stroke-width: 2;
	}
</style>
