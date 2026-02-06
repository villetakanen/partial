import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = join(import.meta.dirname, '..', '..', 'src', 'cli', 'index.ts')

const PLAN_WITH_DEPS = `
version: "1.0.0"
project: StatusTest
tasks:
  - id: a
    title: Task A
    done: true
  - id: b
    title: Task B
    done: true
  - id: c
    title: Task C
    needs:
      - a
  - id: d
    title: Task D
    needs:
      - a
  - id: e
    title: Task E
    needs:
      - c
      - d
  - id: f
    title: Task F
    needs:
      - b
`

/** Run the CLI via tsx and capture stdout, stderr, and exit code. */
function runCLI(
	args: string[],
	stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve) => {
		const child = execFile(
			'npx',
			['tsx', CLI_PATH, ...args],
			{ cwd: join(import.meta.dirname, '..', '..'), timeout: 10000 },
			(error, stdout, stderr) => {
				resolve({
					stdout: stdout.toString(),
					stderr: stderr.toString(),
					exitCode: error?.code != null ? (typeof error.code === 'number' ? error.code : 1) : 0,
				})
			},
		)
		if (stdin && child.stdin) {
			child.stdin.write(stdin)
			child.stdin.end()
		}
	})
}

describe('partial status', () => {
	let tmpDir: string

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), 'partial-status-'))
	})

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true })
	})

	it('prints counts: done, ready, blocked', async () => {
		const filePath = join(tmpDir, 'deps.plan')
		await writeFile(filePath, PLAN_WITH_DEPS)

		const result = await runCLI(['status', filePath])
		// a,b done (2); c,d,f ready (3, all deps done); e blocked (needs c,d not done) (1)
		expect(result.stdout).toContain('Done:    2')
		expect(result.stdout).toContain('Ready:   3')
		expect(result.stdout).toContain('Blocked: 1')
		expect(result.exitCode).toBe(0)
	})

	it('outputs JSON with --json flag', async () => {
		const filePath = join(tmpDir, 'json.plan')
		await writeFile(filePath, PLAN_WITH_DEPS)

		const result = await runCLI(['status', filePath, '--json'])
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ done: 2, ready: 3, blocked: 1 })
		expect(result.exitCode).toBe(0)
	})

	it('exits 0 on success', async () => {
		const filePath = join(tmpDir, 'simple.plan')
		await writeFile(
			filePath,
			`
version: "1.0.0"
project: Simple
tasks:
  - id: x
    title: Task X
`,
		)

		const result = await runCLI(['status', filePath])
		expect(result.exitCode).toBe(0)
	})

	it('supports piped input', async () => {
		const result = await runCLI(['status', '--json'], PLAN_WITH_DEPS)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ done: 2, ready: 3, blocked: 1 })
		expect(result.exitCode).toBe(0)
	})

	it('handles all-done plan', async () => {
		const plan = `
version: "1.0.0"
project: AllDone
tasks:
  - id: a
    title: Task A
    done: true
  - id: b
    title: Task B
    done: true
`
		const result = await runCLI(['status', '--json'], plan)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ done: 2, ready: 0, blocked: 0 })
	})

	it('handles empty task list', async () => {
		const plan = `
version: "1.0.0"
project: Empty
tasks: []
`
		const result = await runCLI(['status', '--json'], plan)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ done: 0, ready: 0, blocked: 0 })
	})

	it('handles no-dependency plan (all tasks ready)', async () => {
		const plan = `
version: "1.0.0"
project: Flat
tasks:
  - id: a
    title: Task A
  - id: b
    title: Task B
  - id: c
    title: Task C
`
		const result = await runCLI(['status', '--json'], plan)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ done: 0, ready: 3, blocked: 0 })
	})

	it('exits 2 for missing file', async () => {
		const result = await runCLI(['status', join(tmpDir, 'missing.plan')])
		expect(result.exitCode).toBe(2)
		expect(result.stderr).toContain('File not found')
	})
})
