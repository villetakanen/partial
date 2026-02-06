import type { PlanFile } from './types'

/**
 * IPC channel names shared between main and renderer processes.
 * Using constants prevents channel name mismatches.
 */
export const IPC_CHANNELS = {
	/** main → renderer: Plan file changed on disk */
	PLAN_UPDATED: 'plan:updated',
	/** main → renderer: Plan file deleted */
	PLAN_DELETED: 'plan:deleted',
	/** main → renderer: Parse error on a plan file */
	PLAN_ERROR: 'plan:error',
	/** renderer → main: User selects a project directory */
	OPEN_DIRECTORY: 'plan:open-directory',
	/** renderer → main: User saves changes from UI */
	SAVE: 'plan:save',
} as const

/** Payload for the `plan:updated` channel (main → renderer) */
export interface PlanUpdatedPayload {
	filePath: string
	plan: PlanFile
}

/** Payload for the `plan:deleted` channel (main → renderer) */
export interface PlanDeletedPayload {
	filePath: string
}

/** Payload for the `plan:error` channel (main → renderer) */
export interface PlanErrorPayload {
	filePath: string
	error: string
}

/** Payload for the `plan:open-directory` channel (renderer → main) */
export interface OpenDirectoryPayload {
	dirPath: string
}

/** Payload for the `plan:save` channel (renderer → main) */
export interface PlanSavePayload {
	filePath: string
	plan: PlanFile
}

/**
 * Typed API exposed to the renderer process via `contextBridge`.
 * The renderer accesses this as `window.api`.
 */
export interface PartialAPI {
	/** Send a request to open and watch a directory */
	openDirectory(payload: OpenDirectoryPayload): Promise<void>
	/** Send a request to save a plan file */
	savePlan(payload: PlanSavePayload): Promise<void>
	/** Register a callback for plan updates */
	onPlanUpdated(callback: (payload: PlanUpdatedPayload) => void): void
	/** Register a callback for plan deletions */
	onPlanDeleted(callback: (payload: PlanDeletedPayload) => void): void
	/** Register a callback for plan errors */
	onPlanError(callback: (payload: PlanErrorPayload) => void): void
}
