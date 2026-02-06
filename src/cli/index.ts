#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { PlanParseError, parsePlan } from '@main/parser'

/** Version from package.json, injected at build time or read dynamically. */
const VERSION = '0.1.0'

const USAGE = `Usage: partial <command> [file.plan] [options]

Commands:
  validate   Validate a .plan file against the schema

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

/** CLI entry point. Parses arguments and dispatches to the appropriate command. */
async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			json: { type: 'boolean', default: false },
			quiet: { type: 'boolean', default: false },
			version: { type: 'boolean', default: false },
			help: { type: 'boolean', default: false },
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
	const filePath = positionals[1]

	if (!command) {
		process.stderr.write(`${USAGE}\n`)
		process.exitCode = 1
		return
	}

	switch (command) {
		case 'validate':
			if (values.help) {
				process.stdout.write(`${VALIDATE_USAGE}\n`)
				return
			}
			await runValidate(filePath, values.json ?? false, values.quiet ?? false)
			break
		default:
			process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`)
			process.exitCode = 1
	}
}

main()
