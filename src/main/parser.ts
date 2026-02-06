import { PlanFileSchema } from '@shared/schemas'
import type { PlanFile } from '@shared/types'
import { parse, stringify } from 'yaml'

/**
 * Error thrown when parsing a `.plan` file fails.
 * Includes line/column information when available from the YAML parser.
 */
export class PlanParseError extends Error {
  readonly line?: number
  readonly column?: number

  constructor(message: string, line?: number, column?: number) {
    super(message)
    this.name = 'PlanParseError'
    this.line = line
    this.column = column
  }
}

/**
 * Parse a `.plan` YAML string into a validated {@link PlanFile}.
 *
 * - Applies defaults: `version` → `"1.0.0"`, `tasks` → `[]`, `task.done` → `false`
 * - Preserves unknown fields at root and task level for forward compatibility
 * - Throws {@link PlanParseError} with line/column on invalid YAML
 * - Returns a valid empty `PlanFile` for empty/whitespace input
 */
export function parsePlan(content: string): PlanFile {
  // Handle empty / whitespace-only input
  const trimmed = content.trim()
  if (trimmed === '') {
    return { version: '1.0.0', project: '', tasks: [] }
  }

  // Parse YAML — may throw on syntax errors
  let raw: unknown
  try {
    raw = parse(trimmed)
  } catch (err: unknown) {
    if (err instanceof Error) {
      // The yaml package includes linePos info in the error
      const yamlErr = err as Error & { linePos?: [{ line: number; col: number }] }
      const line = yamlErr.linePos?.[0]?.line
      const col = yamlErr.linePos?.[0]?.col
      throw new PlanParseError(err.message, line, col)
    }
    throw new PlanParseError(String(err))
  }

  // YAML parsed to null (e.g. just comments) — treat as empty
  if (raw == null || typeof raw !== 'object') {
    return { version: '1.0.0', project: '', tasks: [] }
  }

  // Apply defaults before validation (spread preserves unknown fields)
  const data = raw as Record<string, unknown>
  const withDefaults = {
    ...data,
    version: data.version ?? '1.0.0',
    project: data.project ?? '',
    tasks: Array.isArray(data.tasks)
      ? (data.tasks as Record<string, unknown>[]).map((task) => ({
          ...task,
          done: task.done ?? false,
        }))
      : [],
  }

  // Validate through Zod
  const result = PlanFileSchema.safeParse(withDefaults)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new PlanParseError(`Validation error at ${issue.path.join('.')}: ${issue.message}`)
  }

  return result.data as PlanFile
}

/**
 * Serialize a {@link PlanFile} back to YAML string.
 *
 * - Uses 2-space indentation with no line wrapping
 * - Does not mutate the input object
 * - Field order is stable across calls with identical input
 */
export function stringifyPlan(plan: PlanFile): string {
  return stringify(plan, {
    indent: 2,
    lineWidth: 0,
  })
}
