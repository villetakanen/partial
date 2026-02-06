import { PlanFileSchema, TaskSchema, validatePlan } from '@shared/schemas'
import { describe, expect, it } from 'vitest'

describe('TaskSchema', () => {
  it('validates a task with required fields', () => {
    const result = TaskSchema.safeParse({ id: 'task-1', title: 'Do something' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('task-1')
      expect(result.data.title).toBe('Do something')
    }
  })

  it('rejects a task missing id', () => {
    const result = TaskSchema.safeParse({ title: 'No id' })
    expect(result.success).toBe(false)
  })

  it('rejects a task missing title', () => {
    const result = TaskSchema.safeParse({ id: 'task-1' })
    expect(result.success).toBe(false)
  })

  it('allows unknown fields via passthrough', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'With extras',
      priority: 'high',
      custom_tag: 42,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('high')
      expect(result.data.custom_tag).toBe(42)
    }
  })

  it('validates optional fields', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Full task',
      done: true,
      needs: ['task-0'],
      parent: 'group-a',
      type: 'feature',
      state: 'in_progress',
      needs_fs: ['dep-1'],
      needs_ss: ['dep-2'],
      needs_ff: ['dep-3'],
      needs_sf: ['dep-4'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.done).toBe(true)
      expect(result.data.needs).toEqual(['task-0'])
      expect(result.data.needs_fs).toEqual(['dep-1'])
      expect(result.data.needs_ss).toEqual(['dep-2'])
      expect(result.data.needs_ff).toEqual(['dep-3'])
      expect(result.data.needs_sf).toEqual(['dep-4'])
    }
  })
})

describe('PlanFileSchema', () => {
  it('validates a minimal plan file', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      tasks: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a plan missing project', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      tasks: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const projectError = result.error.issues.find((i) => i.path.includes('project'))
      expect(projectError).toBeDefined()
      expect(projectError?.message).toBeDefined()
    }
  })

  it('rejects a plan missing version', () => {
    const result = PlanFileSchema.safeParse({
      project: 'Test',
      tasks: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a plan missing tasks', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('allows unknown fields at root level via passthrough', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      tasks: [],
      custom_metadata: { author: 'alice' },
      extra_flag: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.custom_metadata).toEqual({ author: 'alice' })
      expect(result.data.extra_flag).toBe(true)
    }
  })

  it('validates tasks within a plan file', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      tasks: [
        { id: 'a', title: 'Task A' },
        { id: 'b', title: 'Task B', done: true, needs: ['a'] },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tasks).toHaveLength(2)
      expect(result.data.tasks[1].done).toBe(true)
    }
  })

  it('rejects a plan with invalid tasks', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a' }], // missing title
    })
    expect(result.success).toBe(false)
  })
})

describe('validatePlan', () => {
  it('returns success with valid data', () => {
    const result = validatePlan({
      version: '1.0.0',
      project: 'My Project',
      tasks: [{ id: 'task-1', title: 'First task' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.project).toBe('My Project')
      expect(result.data.tasks).toHaveLength(1)
    }
  })

  it('returns failure with errors for missing project', () => {
    const result = validatePlan({
      version: '1.0.0',
      tasks: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.issues.length).toBeGreaterThan(0)
      const msg = result.errors.issues[0].message
      expect(msg).toBeDefined()
    }
  })

  it('preserves unknown fields in validated output (round-trip safe)', () => {
    const input = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: 'Task A', priority: 'high', custom_data: [1, 2, 3] }],
      custom_metadata: { author: 'alice' },
    }
    const result = validatePlan(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.custom_metadata).toEqual({ author: 'alice' })
      expect(result.data.tasks[0].priority).toBe('high')
      expect(result.data.tasks[0].custom_data).toEqual([1, 2, 3])
    }
  })

  it('returns actionable error for completely wrong input', () => {
    const result = validatePlan('not an object')
    expect(result.success).toBe(false)
  })

  it('returns actionable error for null input', () => {
    const result = validatePlan(null)
    expect(result.success).toBe(false)
  })
})
