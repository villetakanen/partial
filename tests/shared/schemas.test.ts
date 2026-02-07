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

  it('validates ISO 8601 date fields (start, due)', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Dated task',
      start: '2026-03-01',
      due: '2026-03-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.start).toBe('2026-03-01')
      expect(result.data.due).toBe('2026-03-15')
    }
  })

  it('validates duration field', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Duration task',
      duration: '3d',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration).toBe('3d')
    }
  })

  it('accepts various valid duration formats', () => {
    for (const dur of ['1d', '2w', '4h', '12m']) {
      const result = TaskSchema.safeParse({
        id: 'task-1',
        title: 'Task',
        duration: dur,
      })
      expect(result.success, `Expected "${dur}" to be valid`).toBe(true)
    }
  })

  it('rejects invalid date format in start field', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Bad date',
      start: '03/01/2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format in due field', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Bad date',
      due: 'March 15, 2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid duration format', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Bad duration',
      duration: '3 days',
    })
    expect(result.success).toBe(false)
  })

  it('rejects date-time strings (only YYYY-MM-DD allowed)', () => {
    const result = TaskSchema.safeParse({
      id: 'task-1',
      title: 'Datetime',
      start: '2026-03-01T10:00:00',
    })
    expect(result.success).toBe(false)
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

  it('validates a plan with description field', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      description: 'A sample project description',
      tasks: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('A sample project description')
    }
  })

  it('validates a plan without description (optional)', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      tasks: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it('preserves unknown fields alongside description', () => {
    const result = PlanFileSchema.safeParse({
      version: '1.0.0',
      project: 'Test',
      description: 'With extras',
      tasks: [],
      custom_flag: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('With extras')
      expect(result.data.custom_flag).toBe(true)
    }
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

  it('preserves date and duration fields in validated output (round-trip safe)', () => {
    const input = {
      version: '1.0.0',
      project: 'Test',
      tasks: [
        {
          id: 'a',
          title: 'Dated task',
          start: '2026-03-01',
          due: '2026-03-15',
          duration: '2w',
          custom_field: 'preserved',
        },
      ],
    }
    const result = validatePlan(input)
    expect(result.success).toBe(true)
    if (result.success) {
      const task = result.data.tasks[0]
      expect(task.start).toBe('2026-03-01')
      expect(task.due).toBe('2026-03-15')
      expect(task.duration).toBe('2w')
      expect(task.custom_field).toBe('preserved')
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
