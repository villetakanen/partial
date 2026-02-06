/**
 * .plan file schema types (v1.0.0)
 *
 * Core type definitions for the Partial plan file format.
 * All interfaces include index signatures for forward-compatible
 * unknown field preservation during round-trip parsing.
 */

/**
 * Represents a parsed .plan file.
 * Contains project metadata and a list of tasks.
 * Unknown fields are preserved for forward compatibility.
 */
export interface PlanFile {
  version: string
  project: string
  tasks: Task[]
  /** Preserve unknown fields for forward compatibility */
  [key: string]: unknown
}

/**
 * Represents a single task within a .plan file.
 * Tasks have a unique id, a title, and optional dependency/hierarchy fields.
 * Unknown fields are preserved for forward compatibility.
 */
export interface Task {
  id: string
  title: string
  done?: boolean
  needs?: string[]
  parent?: string
  /** Preserve unknown fields */
  [key: string]: unknown
}

/**
 * The four dependency relationship types between tasks.
 * - `fs` — Finish-to-Start (default): predecessor must finish before successor starts
 * - `ss` — Start-to-Start: both tasks start together
 * - `ff` — Finish-to-Finish: both tasks finish together
 * - `sf` — Start-to-Finish: predecessor must start before successor finishes
 */
export type DependencyType = 'fs' | 'ss' | 'ff' | 'sf'

/**
 * Extended task interface for 1.x.0 features.
 * Adds optional typed dependency arrays (one per {@link DependencyType})
 * and workflow metadata fields.
 */
export interface TaskExtended extends Task {
  type?: string
  state?: string
  needs_fs?: string[]
  needs_ss?: string[]
  needs_ff?: string[]
  needs_sf?: string[]
}
