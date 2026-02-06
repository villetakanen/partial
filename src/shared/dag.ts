import { Graph } from 'graphlib'
import type { DependencyType, Task } from './types'

export type { Graph }

/** Edge label stored on each dependency edge in the graph */
export interface EdgeLabel {
	type: DependencyType
}

/**
 * Build a directed acyclic graph from a list of tasks.
 *
 * Creates a node for each task (keyed by `task.id`, storing the full task object).
 * Creates directed edges from dependency arrays: `needs` (defaults to `fs`),
 * `needs_fs`, `needs_ss`, `needs_ff`, and `needs_sf`.
 *
 * @throws {Error} If a task references a dependency ID that does not exist
 * @returns A graphlib `Graph` instance with typed edge labels
 */
export function buildDAG(tasks: Task[]): Graph {
	const graph = new Graph({ directed: true })

	// Add all task nodes first
	for (const task of tasks) {
		graph.setNode(task.id, task)
	}

	// Add edges from dependency fields
	for (const task of tasks) {
		addEdges(graph, task, task.needs, 'fs')
		addEdges(graph, task, task.needs_fs as string[] | undefined, 'fs')
		addEdges(graph, task, task.needs_ss as string[] | undefined, 'ss')
		addEdges(graph, task, task.needs_ff as string[] | undefined, 'ff')
		addEdges(graph, task, task.needs_sf as string[] | undefined, 'sf')
	}

	return graph
}

/**
 * Add directed edges from dependencies to the dependent task.
 * Edge direction: dependency → dependent (predecessor → successor).
 */
function addEdges(
	graph: Graph,
	task: Task,
	deps: string[] | undefined,
	type: DependencyType,
): void {
	if (!deps) return
	for (const depId of deps) {
		if (!graph.hasNode(depId)) {
			throw new Error(`Task "${task.id}" references non-existent dependency "${depId}"`)
		}
		const label: EdgeLabel = { type }
		graph.setEdge(depId, task.id, label)
	}
}
