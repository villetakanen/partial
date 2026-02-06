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
 * Detect cycles in the graph using depth-first search.
 *
 * @returns The cycle path as an array of task IDs (e.g. `["A", "B", "C", "A"]`),
 *          or `null` if the graph is acyclic.
 */
export function detectCycles(graph: Graph): string[] | null {
	const visited = new Set<string>()
	const inStack = new Set<string>()
	const parent = new Map<string, string>()

	for (const node of graph.nodes()) {
		if (visited.has(node)) continue
		const cycle = dfsVisit(graph, node, visited, inStack, parent)
		if (cycle) return cycle
	}

	return null
}

/** DFS visit for cycle detection. Returns cycle path or null. */
function dfsVisit(
	graph: Graph,
	node: string,
	visited: Set<string>,
	inStack: Set<string>,
	parent: Map<string, string>,
): string[] | null {
	visited.add(node)
	inStack.add(node)

	const successors = graph.successors(node) ?? []
	for (const next of successors) {
		if (inStack.has(next)) {
			return buildCyclePath(parent, node, next)
		}
		if (!visited.has(next)) {
			parent.set(next, node)
			const cycle = dfsVisit(graph, next, visited, inStack, parent)
			if (cycle) return cycle
		}
	}

	inStack.delete(node)
	return null
}

/** Reconstruct cycle path from parent map. */
function buildCyclePath(parent: Map<string, string>, from: string, to: string): string[] {
	const path: string[] = [to]
	let current = from
	while (current !== to) {
		path.push(current)
		current = parent.get(current) ?? to
	}
	path.push(to)
	path.reverse()
	return path
}

/**
 * Return tasks that are not yet done and have no unfinished dependencies.
 *
 * A task is "unblocked" when:
 * - It is not `done`
 * - All of its predecessor tasks in the graph are `done: true`
 *
 * Tasks with no dependencies that are not done are always unblocked.
 *
 * @returns An array of unblocked tasks in their original input order
 */
export function getUnblockedTasks(graph: Graph, tasks: Task[]): Task[] {
	return tasks.filter((t) => {
		if (t.done) return false
		const preds = graph.predecessors(t.id) ?? []
		return preds.every((predId) => {
			const predTask = graph.node(predId) as Task | undefined
			return predTask?.done === true
		})
	})
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
