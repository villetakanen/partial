<script lang="ts">
import type { Graph as DAGGraph, EdgeLabel } from '@shared/dag'
import { getUnblockedTasks } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import * as d3 from 'd3'
import { getContext } from 'svelte'
import { getSimParams } from './graphSimParams'

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
let simNodes = $state<SimNode[]>([])
let simLinks = $state<SimLink[]>([])
let transform = $state(d3.zoomIdentity)

const openDetail = getContext<((task: Task) => void) | undefined>('partial:openDetail')

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

    const params = getSimParams(nodes.length)

    simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(params.linkDistance),
      )
      .force('charge', d3.forceManyBody().strength(params.chargeStrength))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(params.collisionRadius))
      .alphaDecay(params.alphaDecay)
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
  const style = getComputedStyle(document.documentElement)
  switch (status) {
    case 'done':
      return style.getPropertyValue('--color-status-done').trim() || '#4caf50'
    case 'ready':
      return style.getPropertyValue('--color-status-ready').trim() || '#42a5f5'
    case 'blocked':
      return style.getPropertyValue('--color-status-blocked').trim() || '#ef5350'
    default:
      return style.getPropertyValue('--color-text-dim').trim() || '#888'
  }
}

function handleNodeClick(task: Task): void {
  openDetail?.(task)
}

/** Checks if a candidate node is in the correct direction from the origin. */
function isInDirection(key: string, dx: number, dy: number): boolean {
  switch (key) {
    case 'ArrowRight':
      return dx > 0 && Math.abs(dy) < Math.abs(dx)
    case 'ArrowLeft':
      return dx < 0 && Math.abs(dy) < Math.abs(dx)
    case 'ArrowDown':
      return dy > 0 && Math.abs(dx) < Math.abs(dy)
    case 'ArrowUp':
      return dy < 0 && Math.abs(dx) < Math.abs(dy)
    default:
      return false
  }
}

/** Finds the nearest node in a given arrow-key direction from a source node. */
function findNearestInDirection(key: string, from: SimNode): SimNode | null {
  let best: SimNode | null = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const node of simNodes) {
    if (node.id === from.id || node.x == null || node.y == null) continue
    const dx = node.x - (from.x ?? 0)
    const dy = node.y - (from.y ?? 0)
    if (!isInDirection(key, dx, dy)) continue
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      best = node
    }
  }
  return best
}

/** Handles arrow-key navigation between Graph nodes by spatial proximity. */
function handleGraphKeydown(event: KeyboardEvent) {
  if (!event.key.startsWith('Arrow')) return

  const target = event.target as Element
  const nodeGroup = target.closest('.node')
  if (!nodeGroup) return

  const label = nodeGroup.querySelector('text')?.textContent?.trim()
  const current = simNodes.find((n) => n.id === label)
  if (!current || current.x == null || current.y == null) return

  const bestNode = findNearestInDirection(event.key, current)
  if (!bestNode || !svgEl) return

  event.preventDefault()
  const allGroups = Array.from(svgEl.querySelectorAll<SVGGElement>('g.node'))
  const targetGroup = allGroups.find(
    (g) => g.querySelector('text')?.textContent?.trim() === bestNode.id,
  )
  targetGroup?.focus()
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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_redundant_roles -->
<section class="graph-view" role="region" aria-label="Dependency graph" onkeydown={handleGraphKeydown}>
	{#if plan.tasks.length === 0}
		<p class="empty-placeholder">No tasks to display</p>
	{:else}
		<svg bind:this={svgEl} class="graph-svg" aria-label="Task dependency graph">
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
					<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--color-text-hint)" />
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
	{/if}
</section>

<style>
	.graph-view {
		padding: 1rem 0;
		position: relative;
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

	.graph-svg {
		width: 100%;
		height: 100%;
		background: var(--color-surface-inset);
		border-radius: 8px;
		border: 1px solid var(--color-surface-elevated);
		cursor: grab;
	}

	.graph-svg:active {
		cursor: grabbing;
	}

	.edge {
		stroke: var(--color-text-hint);
		stroke-width: 1.5;
	}

	.node {
		cursor: pointer;
	}

	.node:focus-visible circle {
		stroke: var(--color-focus-ring);
		stroke-width: 3;
	}

	.node.done {
		opacity: 0.7;
	}

	.node-label {
		fill: var(--color-text-secondary);
		font-size: 10px;
		font-family: monospace;
		pointer-events: none;
	}

</style>
