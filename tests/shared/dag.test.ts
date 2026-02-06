import {
	buildDAG,
	criticalPath,
	detectCycles,
	type EdgeLabel,
	getUnblockedTasks,
	topologicalSort,
} from '@shared/dag'
import type { Task } from '@shared/types'
import { Graph } from 'graphlib'
import { describe, expect, it } from 'vitest'

function task(id: string, overrides: Partial<Task> = {}): Task {
	return { id, title: `Task ${id}`, ...overrides }
}

describe('buildDAG', () => {
	it('creates a node for each task', () => {
		const tasks = [task('a'), task('b'), task('c')]
		const graph = buildDAG(tasks)
		expect(graph.nodeCount()).toBe(3)
		expect(graph.nodes()).toContain('a')
		expect(graph.nodes()).toContain('b')
		expect(graph.nodes()).toContain('c')
	})

	it('stores the task object as node label', () => {
		const tasks = [task('a', { done: true })]
		const graph = buildDAG(tasks)
		const label = graph.node('a') as Task
		expect(label.id).toBe('a')
		expect(label.done).toBe(true)
	})

	it('creates directed edges from needs arrays', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c', { needs: ['a', 'b'] })]
		const graph = buildDAG(tasks)
		expect(graph.edgeCount()).toBe(3)
		// a → b, a → c, b → c
		expect(graph.edge('a', 'b')).toBeDefined()
		expect(graph.edge('a', 'c')).toBeDefined()
		expect(graph.edge('b', 'c')).toBeDefined()
	})

	it('sets default dependency type to fs for needs array', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] })]
		const graph = buildDAG(tasks)
		const label = graph.edge('a', 'b') as EdgeLabel
		expect(label.type).toBe('fs')
	})

	it('creates typed edges from needs_fs', () => {
		const tasks = [task('a'), task('b', { needs_fs: ['a'] })]
		const graph = buildDAG(tasks)
		const label = graph.edge('a', 'b') as EdgeLabel
		expect(label.type).toBe('fs')
	})

	it('creates typed edges from needs_ss', () => {
		const tasks = [task('a'), task('b', { needs_ss: ['a'] })]
		const graph = buildDAG(tasks)
		const label = graph.edge('a', 'b') as EdgeLabel
		expect(label.type).toBe('ss')
	})

	it('creates typed edges from needs_ff', () => {
		const tasks = [task('a'), task('b', { needs_ff: ['a'] })]
		const graph = buildDAG(tasks)
		const label = graph.edge('a', 'b') as EdgeLabel
		expect(label.type).toBe('ff')
	})

	it('creates typed edges from needs_sf', () => {
		const tasks = [task('a'), task('b', { needs_sf: ['a'] })]
		const graph = buildDAG(tasks)
		const label = graph.edge('a', 'b') as EdgeLabel
		expect(label.type).toBe('sf')
	})

	it('handles all four dependency types on a single task', () => {
		const tasks = [
			task('dep-1'),
			task('dep-2'),
			task('dep-3'),
			task('dep-4'),
			task('consumer', {
				needs_fs: ['dep-1'],
				needs_ss: ['dep-2'],
				needs_ff: ['dep-3'],
				needs_sf: ['dep-4'],
			}),
		]
		const graph = buildDAG(tasks)
		expect(graph.edgeCount()).toBe(4)
		expect((graph.edge('dep-1', 'consumer') as EdgeLabel).type).toBe('fs')
		expect((graph.edge('dep-2', 'consumer') as EdgeLabel).type).toBe('ss')
		expect((graph.edge('dep-3', 'consumer') as EdgeLabel).type).toBe('ff')
		expect((graph.edge('dep-4', 'consumer') as EdgeLabel).type).toBe('sf')
	})

	it('throws on missing dependency reference', () => {
		const tasks = [task('a', { needs: ['nonexistent'] })]
		expect(() => buildDAG(tasks)).toThrow('non-existent dependency "nonexistent"')
	})

	it('error identifies the task with the broken reference', () => {
		const tasks = [task('my-task', { needs: ['missing'] })]
		expect(() => buildDAG(tasks)).toThrow('Task "my-task"')
	})

	it('correctly represents disconnected subgraphs', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c'), task('d', { needs: ['c'] })]
		const graph = buildDAG(tasks)
		expect(graph.nodeCount()).toBe(4)
		expect(graph.edgeCount()).toBe(2)
		// a → b is separate from c → d
		expect(graph.edge('a', 'b')).toBeDefined()
		expect(graph.edge('c', 'd')).toBeDefined()
		expect(graph.edge('a', 'c')).toBeUndefined()
		expect(graph.edge('a', 'd')).toBeUndefined()
	})

	it('handles tasks with no dependencies', () => {
		const tasks = [task('a'), task('b'), task('c')]
		const graph = buildDAG(tasks)
		expect(graph.nodeCount()).toBe(3)
		expect(graph.edgeCount()).toBe(0)
	})

	it('handles empty task list', () => {
		const graph = buildDAG([])
		expect(graph.nodeCount()).toBe(0)
		expect(graph.edgeCount()).toBe(0)
	})

	it('does not create edges from parent field', () => {
		const tasks = [task('group'), task('child', { parent: 'group' })]
		const graph = buildDAG(tasks)
		expect(graph.edgeCount()).toBe(0)
	})
})

describe('detectCycles', () => {
	it('returns null for acyclic graph (linear chain)', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c', { needs: ['b'] })]
		const graph = buildDAG(tasks)
		expect(detectCycles(graph)).toBeNull()
	})

	it('returns null for acyclic graph (diamond)', () => {
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['a'] }),
			task('d', { needs: ['b', 'c'] }),
		]
		const graph = buildDAG(tasks)
		expect(detectCycles(graph)).toBeNull()
	})

	it('returns null for disconnected acyclic graph', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c'), task('d', { needs: ['c'] })]
		const graph = buildDAG(tasks)
		expect(detectCycles(graph)).toBeNull()
	})

	it('detects self-referencing task (A → A)', () => {
		// Build graph manually since buildDAG wouldn't create a self-loop
		const graph = new Graph({ directed: true })
		graph.setNode('a', task('a'))
		graph.setEdge('a', 'a')
		const cycle = detectCycles(graph)
		expect(cycle).not.toBeNull()
		expect(cycle).toContain('a')
	})

	it('detects indirect cycle (A → B → C → A)', () => {
		// A needs C (edge C→A), B needs A (edge A→B), C needs B (edge B→C)
		// This creates the cycle: A→B→C→A
		const tasks = [
			task('a', { needs: ['c'] }),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['b'] }),
		]
		const graph = buildDAG(tasks)
		const cycle = detectCycles(graph)
		expect(cycle).not.toBeNull()
		// Cycle should contain all three nodes and repeat the start
		expect(cycle).toHaveLength(4)
		expect(cycle?.[0]).toBe(cycle?.[3])
		expect(cycle).toContain('a')
		expect(cycle).toContain('b')
		expect(cycle).toContain('c')
	})

	it('returns null for empty graph', () => {
		const graph = buildDAG([])
		expect(detectCycles(graph)).toBeNull()
	})

	it('returns null for single task with no deps', () => {
		const graph = buildDAG([task('a')])
		expect(detectCycles(graph)).toBeNull()
	})
})

describe('getUnblockedTasks', () => {
	it('returns tasks whose dependencies are all done (spec scenario)', () => {
		const tasks = [
			task('a', { done: true }),
			task('b', { needs: ['a'], done: false }),
			task('c', { done: false }),
			task('d', { needs: ['b'], done: false }),
		]
		const graph = buildDAG(tasks)
		const unblocked = getUnblockedTasks(graph, tasks)
		const ids = unblocked.map((t) => t.id)
		expect(ids).toEqual(['b', 'c'])
	})

	it('excludes already-done tasks', () => {
		const tasks = [task('a', { done: true }), task('b', { done: true })]
		const graph = buildDAG(tasks)
		const unblocked = getUnblockedTasks(graph, tasks)
		expect(unblocked).toEqual([])
	})

	it('returns all tasks when none have dependencies and none are done', () => {
		const tasks = [task('a'), task('b'), task('c')]
		const graph = buildDAG(tasks)
		const unblocked = getUnblockedTasks(graph, tasks)
		expect(unblocked).toHaveLength(3)
	})

	it('excludes tasks with any unfinished dependency', () => {
		const tasks = [
			task('a', { done: true }),
			task('b', { done: false }),
			task('c', { needs: ['a', 'b'], done: false }),
		]
		const graph = buildDAG(tasks)
		const unblocked = getUnblockedTasks(graph, tasks)
		const ids = unblocked.map((t) => t.id)
		// c is blocked because b is not done
		expect(ids).toEqual(['b'])
	})

	it('returns empty array when all tasks are done', () => {
		const tasks = [task('a', { done: true }), task('b', { needs: ['a'], done: true })]
		const graph = buildDAG(tasks)
		expect(getUnblockedTasks(graph, tasks)).toEqual([])
	})

	it('returns empty array for empty task list', () => {
		const graph = buildDAG([])
		expect(getUnblockedTasks(graph, [])).toEqual([])
	})

	it('handles diamond dependency where root is done', () => {
		const tasks = [
			task('a', { done: true }),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['a'] }),
			task('d', { needs: ['b', 'c'] }),
		]
		const graph = buildDAG(tasks)
		const ids = getUnblockedTasks(graph, tasks).map((t) => t.id)
		// b and c are unblocked (a is done), d is blocked (b and c not done)
		expect(ids).toEqual(['b', 'c'])
	})

	it('preserves original task order in results', () => {
		const tasks = [task('z'), task('m'), task('a')]
		const graph = buildDAG(tasks)
		const ids = getUnblockedTasks(graph, tasks).map((t) => t.id)
		expect(ids).toEqual(['z', 'm', 'a'])
	})
})

describe('topologicalSort', () => {
	it('returns linear chain in dependency order', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c', { needs: ['b'] })]
		const graph = buildDAG(tasks)
		const ids = topologicalSort(graph).map((t) => t.id)
		expect(ids).toEqual(['a', 'b', 'c'])
	})

	it('returns diamond dependency in valid order (A first, D last)', () => {
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['a'] }),
			task('d', { needs: ['b', 'c'] }),
		]
		const graph = buildDAG(tasks)
		const ids = topologicalSort(graph).map((t) => t.id)
		expect(ids[0]).toBe('a')
		expect(ids[3]).toBe('d')
		// b and c are between, in sorted order for determinism
		expect(ids.slice(1, 3).sort()).toEqual(['b', 'c'])
	})

	it('is deterministic across multiple calls', () => {
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['a'] }),
			task('d', { needs: ['b', 'c'] }),
		]
		const graph = buildDAG(tasks)
		const run1 = topologicalSort(graph).map((t) => t.id)
		const run2 = topologicalSort(graph).map((t) => t.id)
		const run3 = topologicalSort(graph).map((t) => t.id)
		expect(run1).toEqual(run2)
		expect(run2).toEqual(run3)
	})

	it('handles disconnected subgraphs (all tasks included)', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c'), task('d', { needs: ['c'] })]
		const graph = buildDAG(tasks)
		const ids = topologicalSort(graph).map((t) => t.id)
		expect(ids).toHaveLength(4)
		// a before b, c before d
		expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'))
		expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'))
	})

	it('returns tasks with no dependencies in sorted ID order', () => {
		const tasks = [task('z'), task('m'), task('a')]
		const graph = buildDAG(tasks)
		const ids = topologicalSort(graph).map((t) => t.id)
		expect(ids).toEqual(['a', 'm', 'z'])
	})

	it('returns empty array for empty graph', () => {
		const graph = buildDAG([])
		expect(topologicalSort(graph)).toEqual([])
	})

	it('returns single task for single-node graph', () => {
		const graph = buildDAG([task('a')])
		const ids = topologicalSort(graph).map((t) => t.id)
		expect(ids).toEqual(['a'])
	})
})

describe('criticalPath', () => {
	it('returns the linear chain as the critical path', () => {
		const tasks = [task('a'), task('b', { needs: ['a'] }), task('c', { needs: ['b'] })]
		const graph = buildDAG(tasks)
		const ids = criticalPath(graph).map((t) => t.id)
		expect(ids).toEqual(['a', 'b', 'c'])
	})

	it('returns the longest path in a diamond (multi-path)', () => {
		// a → b → d (length 3) and a → c → d (length 3) — both equal
		// But add an extra step: a → b → e → d makes the b path longer
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['a'] }),
			task('e', { needs: ['b'] }),
			task('d', { needs: ['e', 'c'] }),
		]
		const graph = buildDAG(tasks)
		const ids = criticalPath(graph).map((t) => t.id)
		// Longest path: a → b → e → d (length 4)
		expect(ids).toEqual(['a', 'b', 'e', 'd'])
	})

	it('handles single-task graph', () => {
		const graph = buildDAG([task('only')])
		const ids = criticalPath(graph).map((t) => t.id)
		expect(ids).toEqual(['only'])
	})

	it('returns the longest chain across disconnected subgraphs', () => {
		// Subgraph 1: a → b (length 2)
		// Subgraph 2: c → d → e (length 3) — this is longer
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c'),
			task('d', { needs: ['c'] }),
			task('e', { needs: ['d'] }),
		]
		const graph = buildDAG(tasks)
		const ids = criticalPath(graph).map((t) => t.id)
		expect(ids).toEqual(['c', 'd', 'e'])
	})

	it('returns empty array for empty graph', () => {
		const graph = buildDAG([])
		expect(criticalPath(graph)).toEqual([])
	})

	it('returns the correct path when multiple paths have different lengths', () => {
		// a → b → c → f (length 4)
		// a → d → f (length 3)
		// a → e (length 2)
		const tasks = [
			task('a'),
			task('b', { needs: ['a'] }),
			task('c', { needs: ['b'] }),
			task('d', { needs: ['a'] }),
			task('e', { needs: ['a'] }),
			task('f', { needs: ['c', 'd'] }),
		]
		const graph = buildDAG(tasks)
		const ids = criticalPath(graph).map((t) => t.id)
		expect(ids).toEqual(['a', 'b', 'c', 'f'])
	})
})
