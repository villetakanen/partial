import { z } from 'zod'
import type { PlanFile } from './types'

/** ISO 8601 date string pattern (YYYY-MM-DD). */
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO 8601 date (YYYY-MM-DD)')

/** Duration string pattern (e.g. "3d", "1w", "2h", "1m"). */
const durationString = z.string().regex(/^\d+[dhwm]$/, 'Expected duration like 3d, 1w, 2h, 1m')

/**
 * Zod schema for a single task.
 * Validates required fields (`id`, `title`) and preserves
 * unknown fields via `.passthrough()` for forward compatibility.
 */
export const TaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    done: z.boolean().optional(),
    needs: z.array(z.string()).optional(),
    parent: z.string().optional(),
    type: z.string().optional(),
    state: z.string().optional(),
    needs_fs: z.array(z.string()).optional(),
    needs_ss: z.array(z.string()).optional(),
    needs_ff: z.array(z.string()).optional(),
    needs_sf: z.array(z.string()).optional(),
    start: isoDateString.optional(),
    due: isoDateString.optional(),
    duration: durationString.optional(),
  })
  .passthrough()

/**
 * Zod schema for a `.plan` file.
 * Validates required fields (`version`, `project`, `tasks`) and preserves
 * unknown fields via `.passthrough()` for forward compatibility.
 */
export const PlanFileSchema = z
  .object({
    version: z.string(),
    project: z.string(),
    description: z.string().optional(),
    tasks: z.array(TaskSchema),
  })
  .passthrough()

/**
 * Result type for plan validation.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError }

/**
 * Validate raw data against the PlanFile schema.
 * Returns a typed result with either the validated `PlanFile`
 * or a `ZodError` containing actionable error messages.
 */
export function validatePlan(data: unknown): ValidationResult<PlanFile> {
  const result = PlanFileSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data as PlanFile }
  }
  return { success: false, errors: result.error }
}
