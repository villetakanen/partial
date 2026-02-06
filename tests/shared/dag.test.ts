import { buildDAG, type EdgeLabel } from '@shared/dag'
import type { Task } from '@shared/types'
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
