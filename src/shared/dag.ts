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
 * Return tasks in topological order (respecting dependencies).
 *
 * Uses Kahn's algorithm (BFS with in-degree tracking). When multiple tasks
 * have zero in-degree simultaneously, they are processed in sorted ID order
 * to guarantee deterministic output for identical inputs.
 *
 * @returns An array of tasks ordered so that every dependency appears before
 *          the tasks that depend on it
 */
export function topologicalSort(graph: Graph): Task[] {
  const inDegree = new Map<string, number>()
  for (const node of graph.nodes()) {
    inDegree.set(node, (graph.inEdges(node) ?? []).length)
  }

  // Seed queue with zero in-degree nodes, sorted for determinism
  const queue: string[] = graph
    .nodes()
    .filter((n) => inDegree.get(n) === 0)
    .sort()

  const result: Task[] = []
  while (queue.length > 0) {
    const node = queue.shift() as string
    result.push(graph.node(node) as Task)

    const successors = (graph.successors(node) ?? []).slice().sort()
    for (const next of successors) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) {
        // Insert into queue maintaining sorted order
        const idx = queue.findIndex((q) => q > next)
        if (idx === -1) {
          queue.push(next)
        } else {
          queue.splice(idx, 0, next)
        }
      }
    }
  }

  return result
}

/**
 * Compute the critical path — the longest dependency chain in the DAG.
 *
 * Uses dynamic programming over topological order: for each node, the longest
 * path ending at that node equals `1 + max(longest path of predecessors)`.
 * The critical path is the globally longest such chain across all nodes,
 * including disconnected subgraphs.
 *
 * Each task is treated as unit weight (1). Returns tasks along the longest
 * chain in dependency order.
 *
 * @returns An array of tasks forming the critical path, or an empty array
 *          for an empty graph
 */
export function criticalPath(graph: Graph): Task[] {
  const sorted = topologicalSort(graph)
  if (sorted.length === 0) return []

  const { dist, prev } = computeLongestPaths(graph, sorted)
  const endNode = findMaxDistNode(sorted, dist)
  return reconstructPath(graph, prev, endNode)
}

/** Compute longest-path distances and predecessor pointers via DP. */
function computeLongestPaths(
  graph: Graph,
  sorted: Task[],
): { dist: Map<string, number>; prev: Map<string, string | null> } {
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()

  for (const t of sorted) {
    dist.set(t.id, 1)
    prev.set(t.id, null)
  }

  for (const t of sorted) {
    const preds = graph.predecessors(t.id) ?? []
    for (const predId of preds) {
      const candidate = (dist.get(predId) ?? 0) + 1
      if (candidate > (dist.get(t.id) ?? 0)) {
        dist.set(t.id, candidate)
        prev.set(t.id, predId)
      }
    }
  }

  return { dist, prev }
}

/** Find the node with maximum distance (end of critical path). */
function findMaxDistNode(sorted: Task[], dist: Map<string, number>): string {
  let maxNode = sorted[0].id
  let maxDist = dist.get(maxNode) ?? 0
  for (const t of sorted) {
    const d = dist.get(t.id) ?? 0
    if (d > maxDist) {
      maxDist = d
      maxNode = t.id
    }
  }
  return maxNode
}

/** Reconstruct the critical path by following prev pointers. */
function reconstructPath(graph: Graph, prev: Map<string, string | null>, endNode: string): Task[] {
  const path: Task[] = []
  let current: string | null = endNode
  while (current !== null) {
    path.push(graph.node(current) as Task)
    current = prev.get(current) ?? null
  }
  path.reverse()
  return path
}

/**
 * Check if adding a dependency would create a cycle.
 *
 * Tests whether making `toId` depend on `fromId` (i.e. adding `fromId` to
 * `toId.needs`) would introduce a cycle in the task graph.
 *
 * @returns `true` if adding the dependency would create a cycle
 */
export function wouldCreateCycle(tasks: Task[], fromId: string, toId: string): boolean {
  const tempTasks = tasks.map((t) =>
    t.id === toId ? { ...t, needs: [...(t.needs ?? []), fromId] } : t,
  )
  try {
    const graph = buildDAG(tempTasks)
    return detectCycles(graph) !== null
  } catch {
    return true
  }
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
