<script lang="ts">
import type { Graph } from '@shared/dag'
import type { PlanFile, Task } from '@shared/types'
import { getContext } from 'svelte'

interface Props {
  plan: PlanFile
  dag: Graph
}

let { plan, dag }: Props = $props()

const updateTask = getContext<((taskId: string, updates: Partial<Task>) => void) | undefined>(
  'partial:updateTask',
)
const toggleDone = getContext<((taskId: string) => void) | undefined>('partial:toggleDone')
const openDetail = getContext<((task: Task) => void) | undefined>('partial:openDetail')

type ColumnKey =
  | 'done'
  | 'id'
  | 'title'
  | 'state'
  | 'parent'
  | 'start'
  | 'due'
  | 'duration'
  | 'needs'

interface ColumnDef {
  key: ColumnKey
  label: string
  editable: boolean
}

const columns: ColumnDef[] = [
  { key: 'done', label: 'Done', editable: false },
  { key: 'id', label: 'ID', editable: false },
  { key: 'title', label: 'Title', editable: true },
  { key: 'state', label: 'State', editable: true },
  { key: 'parent', label: 'Parent', editable: true },
  { key: 'start', label: 'Start', editable: true },
  { key: 'due', label: 'Due', editable: true },
  { key: 'duration', label: 'Duration', editable: true },
  { key: 'needs', label: 'Needs', editable: true },
]

type SortDir = 'asc' | 'desc' | null

let sortKey = $state<ColumnKey | null>(null)
let sortDir = $state<SortDir>(null)

/** Cycle sort: none → asc → desc → none */
function handleSort(key: ColumnKey) {
  if (key === 'done') return
  if (sortKey !== key) {
    sortKey = key
    sortDir = 'asc'
  } else if (sortDir === 'asc') {
    sortDir = 'desc'
  } else {
    sortKey = null
    sortDir = null
  }
}

/** Get the comparable string value for a task field. */
function getFieldValue(task: Task, key: ColumnKey): string {
  if (key === 'done') return task.done ? '1' : '0'
  if (key === 'needs') return (task.needs ?? []).join(', ')
  const val = task[key]
  if (typeof val === 'string') return val
  return ''
}

const sortedTasks = $derived.by(() => {
  const tasks = [...plan.tasks]
  if (!sortKey || !sortDir) return tasks
  const key = sortKey
  const dir = sortDir
  return tasks.sort((a, b) => {
    const va = getFieldValue(a, key)
    const vb = getFieldValue(b, key)
    const cmp = va.localeCompare(vb)
    return dir === 'asc' ? cmp : -cmp
  })
})

/** Currently editing cell: [taskId, columnKey] */
let editingCell = $state<[string, ColumnKey] | null>(null)
let editValue = $state('')

/** Start editing a cell. */
function startEdit(task: Task, key: ColumnKey) {
  editingCell = [task.id, key]
  if (key === 'needs') {
    editValue = (task.needs ?? []).join(', ')
  } else {
    const val = task[key]
    editValue = typeof val === 'string' ? val : ''
  }
}

/** Commit the edit. */
function commitEdit() {
  if (!editingCell) return
  const [taskId, key] = editingCell
  const task = plan.tasks.find((t) => t.id === taskId)
  if (!task) {
    editingCell = null
    return
  }

  if (key === 'needs') {
    const needsArr = editValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    updateTask?.(taskId, { needs: needsArr.length > 0 ? needsArr : undefined })
  } else {
    const trimmed = editValue.trim()
    updateTask?.(taskId, { [key]: trimmed || undefined })
  }
  editingCell = null
}

/** Cancel the edit. */
function cancelEdit() {
  editingCell = null
}

/** Handle keydown on edit input. */
function handleEditKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    commitEdit()
    // Navigate to next/prev editable cell
    if (!editingCell)
      navigateCell(event.shiftKey ? -1 : 1, (event.target as HTMLElement).closest('td'))
  }
}

/** Navigate to the next or previous editable cell. */
function navigateCell(direction: number, currentTd: Element | null) {
  if (!currentTd) return
  const row = currentTd.closest('tr')
  if (!row) return
  const table = row.closest('tbody')
  if (!table) return

  const rows = Array.from(table.querySelectorAll('tr'))
  const rowIdx = rows.indexOf(row as HTMLTableRowElement)
  const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td[data-editable]'))
  const cellIdx = cells.indexOf(currentTd as HTMLTableCellElement)

  let nextRowIdx = rowIdx
  let nextCellIdx = cellIdx + direction

  if (nextCellIdx >= cells.length) {
    nextRowIdx++
    nextCellIdx = 0
  } else if (nextCellIdx < 0) {
    nextRowIdx--
    const prevRow = rows[nextRowIdx]
    if (prevRow) {
      const prevCells = prevRow.querySelectorAll('td[data-editable]')
      nextCellIdx = prevCells.length - 1
    }
  }

  const nextRow = rows[nextRowIdx]
  if (!nextRow) return
  const nextCells = Array.from(nextRow.querySelectorAll<HTMLTableCellElement>('td[data-editable]'))
  const targetCell = nextCells[Math.max(0, Math.min(nextCellIdx, nextCells.length - 1))]
  if (targetCell) {
    targetCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  }
}

/** Sort indicator character. */
function sortIndicator(key: ColumnKey): string {
  if (sortKey !== key || !sortDir) return ''
  return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_redundant_roles -->
<section class="list-view" role="region" aria-label="Task list">
  {#if plan.tasks.length === 0}
    <p class="empty-placeholder">No tasks to display</p>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            {#each columns as col}
              <th
                class="col-{col.key}"
                class:sortable={col.key !== 'done'}
                onclick={() => handleSort(col.key)}
                aria-sort={sortKey === col.key && sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >{col.label}{sortIndicator(col.key)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each sortedTasks as task (task.id)}
            <tr class:done={task.done}>
              <td class="col-done">
                <input
                  type="checkbox"
                  checked={task.done ?? false}
                  onchange={() => toggleDone?.(task.id)}
                  aria-label="Mark {task.title} as {task.done ? 'not done' : 'done'}"
                />
              </td>
              <td class="col-id" role="button" tabindex="0"
                onclick={() => openDetail?.(task)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetail?.(task) }}
              >{task.id}</td>
              {#each columns.slice(2) as col}
                {#if editingCell && editingCell[0] === task.id && editingCell[1] === col.key}
                  <td class="col-{col.key} editing" data-editable>
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      class="edit-input"
                      type="text"
                      bind:value={editValue}
                      onblur={commitEdit}
                      onkeydown={handleEditKeydown}
                      autofocus
                    />
                  </td>
                {:else}
                  <td
                    class="col-{col.key}"
                    data-editable
                    ondblclick={() => startEdit(task, col.key)}
                  >{getFieldValue(task, col.key)}</td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .list-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
  }

  .empty-placeholder {
    color: var(--color-text-placeholder);
    font-style: italic;
    font-size: 0.8125rem;
    text-align: center;
    padding: 2rem 0;
    margin: 0;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    background: var(--color-surface-card);
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border-primary);
    white-space: nowrap;
    user-select: none;
  }

  th.sortable {
    cursor: pointer;
  }

  th.sortable:hover {
    color: var(--color-text-primary);
  }

  td {
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--color-border-primary);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  td[data-editable] {
    cursor: text;
  }

  td[data-editable]:hover {
    background: var(--color-surface-hover);
  }

  tr.done td {
    color: var(--color-text-done);
  }

  .col-done {
    width: 3rem;
    text-align: center;
  }

  .col-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .col-id:hover {
    color: var(--color-border-accent);
    text-decoration: underline;
  }

  .col-title {
    max-width: 300px;
  }

  .col-needs {
    max-width: 200px;
  }

  .editing {
    padding: 0;
  }

  .edit-input {
    width: 100%;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-surface-inset);
    border: 2px solid var(--color-border-accent);
    outline: none;
    box-sizing: border-box;
  }

  input[type="checkbox"] {
    accent-color: var(--color-status-done);
    cursor: pointer;
    width: 1rem;
    height: 1rem;
  }
</style>
