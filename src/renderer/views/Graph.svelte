<script lang="ts">
import type { Graph as DAGGraph, EdgeLabel } from '@shared/dag'
import { getUnblockedTasks } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import * as d3 from 'd3'

interface Props {
  plan: PlanFile
  dag: DAGGraph
}

let { plan, dag }: Props = $props()

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  task: Task
  status: 'done' | 'blocked' | 'ready'
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  depType: string
}

let svgEl = $state<SVGSVGElement | null>(null)
let selectedTask = $state<Task | null>(null)
let simNodes = $state<SimNode[]>([])
let simLinks = $state<SimLink[]>([])
let transform = $state(d3.zoomIdentity)

let simulation: d3.Simulation<SimNode, SimLink> | null = null
let prevTopologyKey = ''

function getTopologyKey(): string {
  const nodeKeys = plan.tasks
    .map((t) => t.id)
    .sort()
    .join(',')
  const edgeKeys = dag
    .edges()
    .map((e) => `${e.v}->${e.w}`)
    .sort()
    .join(',')
  return `${nodeKeys}|${edgeKeys}`
}

function getStatus(task: Task, unblockedIds: Set<string>): 'done' | 'blocked' | 'ready' {
  if (task.done) return 'done'
  if (unblockedIds.has(task.id)) return 'ready'
  return 'blocked'
}

function buildSimData(): { nodes: SimNode[]; links: SimLink[] } {
  const unblockedIds = new Set(getUnblockedTasks(dag, plan.tasks).map((t) => t.id))

  const nodes: SimNode[] = plan.tasks.map((task) => ({
    id: task.id,
    task,
    status: getStatus(task, unblockedIds),
  }))

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const links: SimLink[] = []
  for (const e of dag.edges()) {
    const source = nodeMap.get(e.v)
    const target = nodeMap.get(e.w)
    if (source && target) {
      const label = dag.edge(e.v, e.w) as EdgeLabel
      links.push({ source, target, depType: label.type })
    }
  }

  return { nodes, links }
}

$effect(() => {
  if (plan.tasks.length === 0) {
    if (simulation) {
      simulation.stop()
      simulation = null
    }
    simNodes = []
    simLinks = []
    prevTopologyKey = ''
    return
  }

  const topoKey = getTopologyKey()
  const topologyChanged = topoKey !== prevTopologyKey
  prevTopologyKey = topoKey

  if (topologyChanged) {
    const { nodes, links } = buildSimData()

    if (simulation) simulation.stop()

    simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(40))
      .alphaDecay(0.02)
      .on('tick', () => {
        simNodes = [...nodes]
        simLinks = [...links]
      })
  } else {
    const unblockedIds = new Set(getUnblockedTasks(dag, plan.tasks).map((t) => t.id))
    for (const node of simNodes) {
      const task = plan.tasks.find((t) => t.id === node.id)
      if (task) {
        node.task = task
        node.status = getStatus(task, unblockedIds)
      }
    }
    simNodes = [...simNodes]
  }
})

$effect(() => {
  if (!svgEl) return

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      transform = event.transform
    })

  d3.select(svgEl).call(zoom)

  return () => {
    if (svgEl) d3.select(svgEl).on('.zoom', null)
    if (simulation) {
      simulation.stop()
      simulation = null
    }
  }
})

function edgeDash(depType: string): string {
  switch (depType) {
    case 'fs':
      return 'none'
    case 'ss':
      return '6,3'
    case 'ff':
      return '3,3'
    case 'sf':
      return '8,3,2,3'
    default:
      return 'none'
  }
}

function nodeColor(status: string): string {
  switch (status) {
    case 'done':
      return '#4caf50'
    case 'ready':
      return '#42a5f5'
    case 'blocked':
      return '#ef5350'
    default:
      return '#888'
  }
}

function handleNodeClick(task: Task): void {
  selectedTask = selectedTask?.id === task.id ? null : task
}

function sourceX(link: SimLink): number {
  return (link.source as SimNode).x ?? 0
}

function sourceY(link: SimLink): number {
  return (link.source as SimNode).y ?? 0
}

function targetX(link: SimLink): number {
  return (link.target as SimNode).x ?? 0
}

function targetY(link: SimLink): number {
  return (link.target as SimNode).y ?? 0
}
</script>

<section class="graph-view" role="region" aria-label="Dependency graph">
	{#if plan.tasks.length === 0}
		<p class="empty-placeholder">No tasks to display</p>
	{:else}
		<svg bind:this={svgEl} class="graph-svg" role="img" aria-label="Task dependency graph">
			<defs>
				<marker
					id="arrowhead"
					viewBox="0 0 10 10"
					refX="28"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 Z" fill="#666" />
				</marker>
			</defs>
			<g transform="translate({transform.x},{transform.y}) scale({transform.k})">
				{#each simLinks as link, i}
					<line
						x1={sourceX(link)}
						y1={sourceY(link)}
						x2={targetX(link)}
						y2={targetY(link)}
						class="edge"
						stroke-dasharray={edgeDash(link.depType)}
						marker-end="url(#arrowhead)"
						aria-hidden="true"
					/>
				{/each}
				{#each simNodes as node (node.id)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<g
						class="node"
						class:done={node.status === 'done'}
						transform="translate({node.x ?? 0},{node.y ?? 0})"
						tabindex="0"
						role="button"
						aria-label="{node.task.title} ({node.status})"
						onclick={() => handleNodeClick(node.task)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') handleNodeClick(node.task)
						}}
					>
						<circle r="18" fill={nodeColor(node.status)} />
						<text class="node-label" dy="32" text-anchor="middle">
							{node.task.id}
						</text>
					</g>
				{/each}
			</g>
		</svg>
		{#if selectedTask}
			<div class="detail-panel" role="complementary" aria-label="Task details">
				<h3 class="detail-title">{selectedTask.title}</h3>
				<dl class="detail-fields">
					<dt>ID</dt>
					<dd>{selectedTask.id}</dd>
					<dt>Status</dt>
					<dd>{selectedTask.done ? 'Done' : 'Not done'}</dd>
					{#if selectedTask.needs && selectedTask.needs.length > 0}
						<dt>Dependencies</dt>
						<dd>{selectedTask.needs.join(', ')}</dd>
					{/if}
					{#if selectedTask.parent}
						<dt>Parent</dt>
						<dd>{selectedTask.parent}</dd>
					{/if}
				</dl>
				<button class="detail-close" onclick={() => (selectedTask = null)}>Close</button>
			</div>
		{/if}
	{/if}
</section>

<style>
	.graph-view {
		padding: 1rem 0;
		position: relative;
	}

	.empty-placeholder {
		color: #555;
		font-style: italic;
		font-size: 0.8125rem;
		text-align: center;
		padding: 2rem 0;
		margin: 0;
	}

	.graph-svg {
		width: 100%;
		height: 500px;
		background: #121225;
		border-radius: 8px;
		border: 1px solid #2a2a3e;
		cursor: grab;
	}

	.graph-svg:active {
		cursor: grabbing;
	}

	.edge {
		stroke: #666;
		stroke-width: 1.5;
	}

	.node {
		cursor: pointer;
	}

	.node:focus-visible circle {
		stroke: #6a6aff;
		stroke-width: 3;
	}

	.node.done {
		opacity: 0.5;
	}

	.node-label {
		fill: #ccc;
		font-size: 10px;
		font-family: monospace;
		pointer-events: none;
	}

	.detail-panel {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: #1a1a2e;
		border: 1px solid #2a2a3e;
		border-radius: 8px;
		padding: 1rem;
		min-width: 200px;
		max-width: 300px;
		z-index: 10;
	}

	.detail-title {
		margin: 0 0 0.75rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #e0e0e0;
	}

	.detail-fields {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.75rem;
		font-size: 0.8125rem;
	}

	.detail-fields dt {
		color: #888;
		font-weight: 500;
	}

	.detail-fields dd {
		margin: 0;
		color: #ccc;
		font-family: monospace;
	}

	.detail-close {
		margin-top: 0.75rem;
		padding: 0.25rem 0.75rem;
		background: #2a2a3e;
		border: 1px solid #3a3a4e;
		border-radius: 4px;
		color: #ccc;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.detail-close:hover {
		background: #3a3a4e;
	}
</style>
