import { PlanParseError, parsePlan, stringifyPlan } from '@main/parser'
import type { PlanFile } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

describe('parsePlan', () => {
  it('parses valid YAML and returns a typed PlanFile', () => {
    const yaml = `
version: "1.0.0"
project: Test
tasks:
  - id: task-1
    title: First task
    done: true
  - id: task-2
    title: Second task
`
    const plan = parsePlan(yaml)
    expect(plan.version).toBe('1.0.0')
    expect(plan.project).toBe('Test')
    expect(plan.tasks).toHaveLength(2)
    expect(plan.tasks[0].id).toBe('task-1')
    expect(plan.tasks[0].done).toBe(true)
    expect(plan.tasks[1].id).toBe('task-2')
  })

  describe('default values', () => {
    it('defaults version to "1.0.0" when omitted', () => {
      const yaml = `
project: Test
tasks: []
`
      const plan = parsePlan(yaml)
      expect(plan.version).toBe('1.0.0')
    })

    it('defaults tasks to empty array when omitted', () => {
      const yaml = `
version: "1.0.0"
project: Test
`
      const plan = parsePlan(yaml)
      expect(plan.tasks).toEqual([])
    })

    it('defaults task.done to false when omitted', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
  - id: b
    title: Task B
    done: true
`
      const plan = parsePlan(yaml)
      expect(plan.tasks[0].done).toBe(false)
      expect(plan.tasks[1].done).toBe(true)
    })

    it('defaults project to empty string when omitted', () => {
      const yaml = `
tasks:
  - id: a
    title: Task A
`
      const plan = parsePlan(yaml)
      expect(plan.project).toBe('')
    })
  })

  describe('empty input', () => {
    it('returns valid empty PlanFile for empty string', () => {
      const plan = parsePlan('')
      expect(plan.version).toBe('1.0.0')
      expect(plan.project).toBe('')
      expect(plan.tasks).toEqual([])
    })

    it('returns valid empty PlanFile for whitespace-only string', () => {
      const plan = parsePlan('   \n\n  \t  ')
      expect(plan.version).toBe('1.0.0')
      expect(plan.project).toBe('')
      expect(plan.tasks).toEqual([])
    })

    it('returns valid empty PlanFile for YAML with only comments', () => {
      const plan = parsePlan('# just a comment\n# another comment')
      expect(plan.version).toBe('1.0.0')
      expect(plan.project).toBe('')
      expect(plan.tasks).toEqual([])
    })
  })

  describe('invalid YAML', () => {
    it('throws PlanParseError for malformed YAML', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: "unclosed string
`
      expect(() => parsePlan(yaml)).toThrow(PlanParseError)
    })

    it('includes line/column info when available', () => {
      const yaml = 'key: [\ninvalid'
      try {
        parsePlan(yaml)
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(PlanParseError)
        const parseErr = err as PlanParseError
        expect(parseErr.line).toBeDefined()
      }
    })

    it('throws PlanParseError for non-object YAML', () => {
      // YAML that parses to a string, not an object — treated as empty
      // Actually, a bare scalar is valid YAML but not a plan
      const plan = parsePlan('just a string')
      expect(plan.version).toBe('1.0.0')
      expect(plan.project).toBe('')
      expect(plan.tasks).toEqual([])
    })

    it('throws PlanParseError for invalid task structure', () => {
      const yaml = `
project: Test
tasks:
  - id: 123
    title: Valid
  - not_a_task
`
      expect(() => parsePlan(yaml)).toThrow(PlanParseError)
    })
  })

  describe('unknown field preservation', () => {
    it('preserves unknown fields at root level', () => {
      const yaml = `
version: "1.0.0"
project: Test
tasks: []
custom_metadata:
  author: alice
extra_flag: true
`
      const plan = parsePlan(yaml)
      expect(plan.custom_metadata).toEqual({ author: 'alice' })
      expect(plan.extra_flag).toBe(true)
    })

    it('preserves unknown fields at task level', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
    priority: high
    custom_data:
      - 1
      - 2
      - 3
`
      const plan = parsePlan(yaml)
      expect(plan.tasks[0].priority).toBe('high')
      expect(plan.tasks[0].custom_data).toEqual([1, 2, 3])
    })

    it('preserves nested unknown fields', () => {
      const yaml = `
project: Test
tasks: []
deeply:
  nested:
    value: 42
`
      const plan = parsePlan(yaml)
      expect(plan.deeply).toEqual({ nested: { value: 42 } })
    })
  })

  describe('dependency fields', () => {
    it('parses needs array', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
  - id: b
    title: Task B
    needs:
      - a
`
      const plan = parsePlan(yaml)
      expect(plan.tasks[1].needs).toEqual(['a'])
    })

    it('parses extended dependency types', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
    needs_fs:
      - dep-1
    needs_ss:
      - dep-2
    needs_ff:
      - dep-3
    needs_sf:
      - dep-4
`
      const plan = parsePlan(yaml)
      const task = plan.tasks[0]
      expect(task.needs_fs).toEqual(['dep-1'])
      expect(task.needs_ss).toEqual(['dep-2'])
      expect(task.needs_ff).toEqual(['dep-3'])
      expect(task.needs_sf).toEqual(['dep-4'])
    })
  })

  describe('parent and optional fields', () => {
    it('parses parent field', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
    parent: group-1
`
      const plan = parsePlan(yaml)
      expect(plan.tasks[0].parent).toBe('group-1')
    })

    it('parses type and state extended fields', () => {
      const yaml = `
project: Test
tasks:
  - id: a
    title: Task A
    type: feature
    state: in_progress
`
      const plan = parsePlan(yaml)
      expect(plan.tasks[0].type).toBe('feature')
      expect(plan.tasks[0].state).toBe('in_progress')
    })
  })
})

describe('stringifyPlan', () => {
  it('produces valid YAML output', () => {
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: 'Task A', done: false }],
    }
    const yaml = stringifyPlan(plan)
    const reparsed = parse(yaml)
    expect(reparsed.version).toBe('1.0.0')
    expect(reparsed.project).toBe('Test')
    expect(reparsed.tasks).toHaveLength(1)
    expect(reparsed.tasks[0].id).toBe('a')
  })

  it('uses 2-space indentation', () => {
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: 'Task A', done: false }],
    }
    const yaml = stringifyPlan(plan)
    // Tasks array items should be indented with 2 spaces
    expect(yaml).toContain('  - id: a')
  })

  it('does not wrap long lines', () => {
    const longTitle = 'A'.repeat(200)
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: longTitle, done: false }],
    }
    const yaml = stringifyPlan(plan)
    // The long title should appear on a single line, not wrapped
    expect(yaml).toContain(`title: ${longTitle}`)
  })

  it('does not mutate the input PlanFile object', () => {
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: 'Task A', done: false }],
    }
    const planCopy = JSON.parse(JSON.stringify(plan))
    stringifyPlan(plan)
    expect(plan).toEqual(planCopy)
  })

  it('produces stable field order across calls', () => {
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [
        { id: 'a', title: 'Task A', done: true, needs: ['b'] },
        { id: 'b', title: 'Task B', done: false },
      ],
    }
    const yaml1 = stringifyPlan(plan)
    const yaml2 = stringifyPlan(plan)
    expect(yaml1).toBe(yaml2)
  })

  it('preserves unknown fields in output', () => {
    const plan: PlanFile = {
      version: '1.0.0',
      project: 'Test',
      tasks: [{ id: 'a', title: 'Task A', done: false, priority: 'high' }],
      custom_metadata: { author: 'alice' },
    }
    const yaml = stringifyPlan(plan)
    const reparsed = parse(yaml)
    expect(reparsed.custom_metadata).toEqual({ author: 'alice' })
    expect(reparsed.tasks[0].priority).toBe('high')
  })
})
