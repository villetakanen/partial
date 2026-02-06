import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = join(import.meta.dirname, '..', '..', 'src', 'cli', 'index.ts')

const PLAN_WITH_DEPS = `
version: "1.0.0"
project: UnblockedTest
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

describe('partial unblocked', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-unblocked-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('prints unblocked task IDs one per line', async () => {
    const filePath = join(tmpDir, 'deps.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['unblocked', filePath])
    const ids = result.stdout.trim().split('\n')
    // a,b done; c,d,f have all deps done → unblocked; e blocked (c,d not done)
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('f')
    expect(ids).not.toContain('a')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('e')
    expect(result.exitCode).toBe(0)
  })

  it('outputs JSON array of task objects with --json', async () => {
    const filePath = join(tmpDir, 'json.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['unblocked', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())
    expect(Array.isArray(parsed)).toBe(true)
    const ids = parsed.map((t: { id: string }) => t.id)
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('f')
    expect(ids).not.toContain('e')
    expect(result.exitCode).toBe(0)
  })

  it('exits 0 on success', async () => {
    const filePath = join(tmpDir, 'success.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['unblocked', filePath])
    expect(result.exitCode).toBe(0)
  })

  it('supports piped input', async () => {
    const result = await runCLI(['unblocked', '--json'], PLAN_WITH_DEPS)
    const parsed = JSON.parse(result.stdout.trim())
    const ids = parsed.map((t: { id: string }) => t.id)
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('f')
    expect(result.exitCode).toBe(0)
  })

  it('returns empty list when all tasks are done', async () => {
    const plan = `
version: "1.0.0"
project: AllDone
tasks:
  - id: a
    title: Task A
    done: true
`
    const result = await runCLI(['unblocked', '--json'], plan)
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed).toEqual([])
  })

  it('returns all tasks when none have dependencies', async () => {
    const plan = `
version: "1.0.0"
project: NoDeps
tasks:
  - id: x
    title: Task X
  - id: y
    title: Task Y
`
    const result = await runCLI(['unblocked', '--json'], plan)
    const parsed = JSON.parse(result.stdout.trim())
    const ids = parsed.map((t: { id: string }) => t.id)
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })

  it('exits 2 for missing file', async () => {
    const result = await runCLI(['unblocked', join(tmpDir, 'missing.plan')])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('File not found')
  })
})
