#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { PlanParseError, parsePlan } from '@main/parser'
import type { EdgeLabel } from '@shared/dag'
import { buildDAG, getUnblockedTasks } from '@shared/dag'
import type { Task } from '@shared/types'

/** Version from package.json, injected at build time or read dynamically. */
const VERSION = '0.1.0'

const USAGE = `Usage: partial <command> [file.plan] [options]

Commands:
  validate   Validate a .plan file against the schema
  status     Show project status summary (done, ready, blocked)
  unblocked  List tasks with all dependencies satisfied
  graph      Show dependency graph as text edges or JSON adjacency

Options:
  --json      Output structured JSON
  --quiet     Suppress non-error output
  --version   Print version and exit
  --help      Print usage and exit

If no file is given, reads from stdin.`

const VALIDATE_USAGE = `Usage: partial validate [file.plan] [options]

Validate a .plan file against the schema.

Options:
  --json      Output structured JSON
  --quiet     Suppress non-error output
  --help      Print this help

Exit codes:
  0  Valid file
  1  Invalid file (schema/parse error)
  2  System error (file not found, permission denied)`

const STATUS_USAGE = `Usage: partial status [file.plan] [options]

Show project status summary with task counts by state.

Options:
  --json      Output structured JSON
  --quiet     Suppress non-error output
  --help      Print this help`

const UNBLOCKED_USAGE = `Usage: partial unblocked [file.plan] [options]

List tasks whose dependencies are all satisfied.

Options:
  --json      Output structured JSON (array of task objects)
  --quiet     Suppress non-error output
  --help      Print this help`

const GRAPH_USAGE = `Usage: partial graph [file.plan] [options]

Show the dependency graph as text edges, JSON adjacency list, or DOT format.

Options:
  --format <fmt>  Output format: text (default) or dot (Graphviz DOT)
  --json          Output JSON adjacency structure
  --quiet         Suppress non-error output
  --help          Print this help`

/**
 * Read plan content from a file path or stdin.
 *
 * When a file path is provided, reads the file from disk.
 * When no path is given, reads from stdin (for piped input).
 *
 * @param filePath - Optional path to a .plan file
 * @returns The file content as a string
 */
async function readInput(filePath: string | undefined): Promise<string> {
  if (filePath) {
    return readFile(filePath, 'utf-8')
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/** Build a human-readable message from a file read error. */
function formatReadError(err: unknown, filePath: string | undefined): string {
  if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
    return `File not found: ${filePath}`
  }
  return `Failed to read input: ${err instanceof Error ? err.message : String(err)}`
}

/** Write a result to stdout (JSON) or stderr (text) based on output mode. */
function writeResult(message: string, json: boolean, data: Record<string, unknown>): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(data)}\n`)
  } else {
    process.stderr.write(`${message}\n`)
  }
}

/**
 * Read and parse a .plan file, handling read and parse errors with proper exit codes.
 *
 * @returns The parsed PlanFile, or null if an error occurred (exitCode is set).
 */
async function readAndParse(
  filePath: string | undefined,
  json: boolean,
): Promise<ReturnType<typeof parsePlan> | null> {
  let content: string
  try {
    content = await readInput(filePath)
  } catch (err) {
    const message = formatReadError(err, filePath)
    writeResult(message, json, { error: message })
    process.exitCode = 2
    return null
  }

  try {
    return parsePlan(content)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeResult(message, json, { error: message })
    process.exitCode = 1
    return null
  }
}

/**
 * Run the `validate` command.
 *
 * Parses a `.plan` file and reports whether it is valid.
 * Prints "Valid" on success, or error details on failure.
 *
 * @param filePath - Optional path to the .plan file (reads stdin if omitted)
 * @param json - Whether to output structured JSON
 * @param quiet - Whether to suppress non-error output
 */
async function runValidate(
  filePath: string | undefined,
  json: boolean,
  quiet: boolean,
): Promise<void> {
  let content: string
  try {
    content = await readInput(filePath)
  } catch (err) {
    const message = formatReadError(err, filePath)
    writeResult(message, json, { valid: false, error: message })
    process.exitCode = 2
    return
  }

  try {
    parsePlan(content)
    if (json) {
      process.stdout.write(`${JSON.stringify({ valid: true })}\n`)
    } else if (!quiet) {
      process.stdout.write('Valid\n')
    }
    process.exitCode = 0
  } catch (err) {
    const parseErr = err instanceof PlanParseError ? err : null
    const message = parseErr?.message ?? (err instanceof Error ? err.message : String(err))
    writeResult(message, json, {
      valid: false,
      error: message,
      line: parseErr?.line,
      column: parseErr?.column,
    })
    process.exitCode = 1
  }
}

/**
 * Run the `status` command.
 *
 * Parses a `.plan` file, builds the DAG, and reports task counts
 * by state: done, ready, and blocked.
 *
 * @param filePath - Optional path to the .plan file (reads stdin if omitted)
 * @param json - Whether to output structured JSON
 * @param quiet - Whether to suppress non-error output
 */
async function runStatus(
  filePath: string | undefined,
  json: boolean,
  quiet: boolean,
): Promise<void> {
  const plan = await readAndParse(filePath, json)
  if (!plan) return

  const tasks = plan.tasks
  const graph = buildDAG(tasks)
  const unblocked = getUnblockedTasks(graph, tasks)
  const unblockedIds = new Set(unblocked.map((t) => t.id))

  const done = tasks.filter((t) => t.done).length
  const ready = unblockedIds.size
  const blocked = tasks.length - done - ready

  if (json) {
    process.stdout.write(`${JSON.stringify({ done, ready, blocked })}\n`)
  } else if (!quiet) {
    process.stdout.write(`Done:    ${done}\nReady:   ${ready}\nBlocked: ${blocked}\n`)
  }
  process.exitCode = 0
}

/**
 * Run the `unblocked` command.
 *
 * Parses a `.plan` file, builds the DAG, and lists tasks whose
 * dependencies are all satisfied (done).
 *
 * @param filePath - Optional path to the .plan file (reads stdin if omitted)
 * @param json - Whether to output structured JSON
 * @param quiet - Whether to suppress non-error output
 */
async function runUnblocked(
  filePath: string | undefined,
  json: boolean,
  quiet: boolean,
): Promise<void> {
  const plan = await readAndParse(filePath, json)
  if (!plan) return

  const graph = buildDAG(plan.tasks)
  const unblocked = getUnblockedTasks(graph, plan.tasks)

  if (json) {
    process.stdout.write(`${JSON.stringify(unblocked)}\n`)
  } else if (!quiet) {
    for (const task of unblocked) {
      process.stdout.write(`${task.id}\n`)
    }
  }
  process.exitCode = 0
}

/**
 * Escape a string for use inside a DOT label (double-quoted context).
 * Escapes backslashes, double quotes, and newlines.
 */
function dotEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/**
 * Generate a Graphviz DOT representation of the dependency graph.
 *
 * Done tasks are styled with a gray fill. Edge labels show the dependency type.
 *
 * @param graph - The built DAG
 * @param tasks - The task list (for done status lookup)
 * @returns A DOT format string
 */
function generateDot(graph: ReturnType<typeof buildDAG>, tasks: Task[]): string {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const lines: string[] = ['digraph dependencies {']
  lines.push('  rankdir=LR;')
  lines.push('  node [shape=box, style=filled, fillcolor="#42a5f5", fontcolor=white];')

  for (const nodeId of graph.nodes()) {
    const task = taskMap.get(nodeId)
    const label = task ? `${nodeId}\\n${dotEscape(task.title)}` : nodeId
    if (task?.done) {
      lines.push(`  "${dotEscape(nodeId)}" [label="${label}", fillcolor="#9e9e9e"];`)
    } else {
      lines.push(`  "${dotEscape(nodeId)}" [label="${label}"];`)
    }
  }

  for (const e of graph.edges()) {
    const edgeLabel = graph.edge(e.v, e.w) as EdgeLabel
    lines.push(`  "${dotEscape(e.v)}" -> "${dotEscape(e.w)}" [label="${edgeLabel.type}"];`)
  }

  lines.push('}')
  return lines.join('\n')
}

/**
 * Run the `graph` command.
 *
 * Parses a `.plan` file, builds the DAG, and displays the dependency
 * graph as text edges (e.g. `A → B (fs)`), JSON adjacency structure,
 * or Graphviz DOT format.
 *
 * @param filePath - Optional path to the .plan file (reads stdin if omitted)
 * @param json - Whether to output structured JSON
 * @param quiet - Whether to suppress non-error output
 * @param format - Output format: 'text' (default) or 'dot'
 */
async function runGraph(
  filePath: string | undefined,
  json: boolean,
  quiet: boolean,
  format: string,
): Promise<void> {
  const plan = await readAndParse(filePath, json)
  if (!plan) return

  const graph = buildDAG(plan.tasks)
  const edges = graph.edges()

  if (json) {
    const adjacency: Record<string, Array<{ target: string; type: string }>> = {}
    for (const node of graph.nodes()) {
      adjacency[node] = []
    }
    for (const e of edges) {
      const label = graph.edge(e.v, e.w) as EdgeLabel
      adjacency[e.v].push({ target: e.w, type: label.type })
    }
    process.stdout.write(`${JSON.stringify(adjacency)}\n`)
  } else if (format === 'dot') {
    process.stdout.write(`${generateDot(graph, plan.tasks)}\n`)
  } else if (!quiet) {
    if (edges.length === 0) {
      process.stdout.write('No dependencies\n')
    } else {
      for (const e of edges) {
        const label = graph.edge(e.v, e.w) as EdgeLabel
        process.stdout.write(`${e.v} → ${e.w} (${label.type})\n`)
      }
    }
  }
  process.exitCode = 0
}

/** Command help text by command name. */
const COMMAND_HELP: Record<string, string> = {
  validate: VALIDATE_USAGE,
  status: STATUS_USAGE,
  unblocked: UNBLOCKED_USAGE,
  graph: GRAPH_USAGE,
}

/** Dispatch the parsed command to the appropriate handler. */
async function dispatchCommand(
  command: string,
  filePath: string | undefined,
  flags: { json: boolean; quiet: boolean; help: boolean; format: string },
): Promise<void> {
  const helpText = COMMAND_HELP[command]
  if (flags.help && helpText) {
    process.stdout.write(`${helpText}\n`)
    return
  }

  switch (command) {
    case 'validate':
      await runValidate(filePath, flags.json, flags.quiet)
      break
    case 'status':
      await runStatus(filePath, flags.json, flags.quiet)
      break
    case 'unblocked':
      await runUnblocked(filePath, flags.json, flags.quiet)
      break
    case 'graph':
      await runGraph(filePath, flags.json, flags.quiet, flags.format)
      break
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`)
      process.exitCode = 1
  }
}

/** CLI entry point. Parses arguments and dispatches to the appropriate command. */
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      format: { type: 'string', default: 'text' },
    },
  })

  if (values.version) {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  if (values.help && positionals.length === 0) {
    process.stdout.write(`${USAGE}\n`)
    return
  }

  const command = positionals[0]
  if (!command) {
    process.stderr.write(`${USAGE}\n`)
    process.exitCode = 1
    return
  }

  await dispatchCommand(command, positionals[1], {
    json: values.json ?? false,
    quiet: values.quiet ?? false,
    help: values.help ?? false,
    format: values.format ?? 'text',
  })
}

main()
