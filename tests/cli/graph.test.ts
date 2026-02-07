import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = join(import.meta.dirname, '..', '..', 'src', 'cli', 'index.ts')

const PLAN_WITH_DEPS = `
version: "1.0.0"
project: GraphTest
tasks:
  - id: a
    title: Task A
  - id: b
    title: Task B
    needs:
      - a
  - id: c
    title: Task C
    needs:
      - b
`

const PLAN_MULTI_TYPES = `
version: "1.0.0"
project: MultiType
tasks:
  - id: alpha
    title: Alpha
  - id: bravo
    title: Bravo
    needs:
      - alpha
  - id: charlie
    title: Charlie
    needs_ss:
      - bravo
  - id: delta
    title: Delta
    needs_ff:
      - charlie
`

const PLAN_NO_DEPS = `
version: "1.0.0"
project: NoDeps
tasks:
  - id: x
    title: Task X
  - id: y
    title: Task Y
`

const PLAN_WITH_DONE = `
version: "1.0.0"
project: DoneTest
tasks:
  - id: a
    title: Task A
    done: true
  - id: b
    title: Task B
    needs:
      - a
    done: false
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

describe('partial graph', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-graph-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('prints text dependency edges', async () => {
    const filePath = join(tmpDir, 'chain.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath])
    const lines = result.stdout.trim().split('\n')

    expect(lines).toContain('a → b (fs)')
    expect(lines).toContain('b → c (fs)')
    expect(lines.length).toBe(2)
    expect(result.exitCode).toBe(0)
  })

  it('shows dependency type in text edges', async () => {
    const filePath = join(tmpDir, 'multi.plan')
    await writeFile(filePath, PLAN_MULTI_TYPES)

    const result = await runCLI(['graph', filePath])
    const lines = result.stdout.trim().split('\n')

    expect(lines).toContain('alpha → bravo (fs)')
    expect(lines).toContain('bravo → charlie (ss)')
    expect(lines).toContain('charlie → delta (ff)')
    expect(result.exitCode).toBe(0)
  })

  it('outputs JSON adjacency structure with --json', async () => {
    const filePath = join(tmpDir, 'json.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())

    expect(parsed.a).toEqual([{ target: 'b', type: 'fs' }])
    expect(parsed.b).toEqual([{ target: 'c', type: 'fs' }])
    expect(parsed.c).toEqual([])
    expect(result.exitCode).toBe(0)
  })

  it('JSON adjacency includes all nodes', async () => {
    const filePath = join(tmpDir, 'nodes.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())

    expect(Object.keys(parsed)).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(Object.keys(parsed).length).toBe(3)
  })

  it('exits 0 on success', async () => {
    const filePath = join(tmpDir, 'success.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath])
    expect(result.exitCode).toBe(0)
  })

  it('supports piped input', async () => {
    const result = await runCLI(['graph', '--json'], PLAN_WITH_DEPS)
    const parsed = JSON.parse(result.stdout.trim())

    expect(parsed.a).toEqual([{ target: 'b', type: 'fs' }])
    expect(parsed.b).toEqual([{ target: 'c', type: 'fs' }])
    expect(result.exitCode).toBe(0)
  })

  it('prints "No dependencies" when no edges exist', async () => {
    const filePath = join(tmpDir, 'nodeps.plan')
    await writeFile(filePath, PLAN_NO_DEPS)

    const result = await runCLI(['graph', filePath])
    expect(result.stdout.trim()).toBe('No dependencies')
    expect(result.exitCode).toBe(0)
  })

  it('outputs empty adjacency lists with --json when no edges', async () => {
    const filePath = join(tmpDir, 'nodeps-json.plan')
    await writeFile(filePath, PLAN_NO_DEPS)

    const result = await runCLI(['graph', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())

    expect(parsed.x).toEqual([])
    expect(parsed.y).toEqual([])
  })

  it('exits 2 for missing file', async () => {
    const result = await runCLI(['graph', join(tmpDir, 'missing.plan')])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('File not found')
  })

  it('suppresses output with --quiet', async () => {
    const filePath = join(tmpDir, 'quiet.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--quiet'])
    expect(result.stdout).toBe('')
    expect(result.exitCode).toBe(0)
  })

  it('outputs valid DOT syntax with --format dot', async () => {
    const filePath = join(tmpDir, 'dot-basic.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--format', 'dot'])
    expect(result.stdout).toContain('digraph dependencies {')
    expect(result.stdout).toContain('}')
    expect(result.exitCode).toBe(0)
  })

  it('DOT output includes node labels with task titles', async () => {
    const filePath = join(tmpDir, 'dot-labels.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--format', 'dot'])
    expect(result.stdout).toContain('Task A')
    expect(result.stdout).toContain('Task B')
    expect(result.stdout).toContain('Task C')
  })

  it('DOT output includes directed edges', async () => {
    const filePath = join(tmpDir, 'dot-edges.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath, '--format', 'dot'])
    expect(result.stdout).toContain('"a" -> "b"')
    expect(result.stdout).toContain('"b" -> "c"')
  })

  it('DOT output styles done tasks differently', async () => {
    const filePath = join(tmpDir, 'dot-done.plan')
    await writeFile(filePath, PLAN_WITH_DONE)

    const result = await runCLI(['graph', filePath, '--format', 'dot'])
    // Done task should have gray fill
    expect(result.stdout).toMatch(/"a".*fillcolor="#9e9e9e"/)
    // Not-done task should NOT have gray fill
    expect(result.stdout).not.toMatch(/"b".*fillcolor="#9e9e9e"/)
    expect(result.exitCode).toBe(0)
  })

  it('default graph output is unchanged when --format is not specified', async () => {
    const filePath = join(tmpDir, 'dot-default.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    const result = await runCLI(['graph', filePath])
    // Should be text format, not DOT
    expect(result.stdout).toContain('a → b (fs)')
    expect(result.stdout).not.toContain('digraph')
    expect(result.exitCode).toBe(0)
  })

  it('--json flag still works alongside --format', async () => {
    const filePath = join(tmpDir, 'dot-json.plan')
    await writeFile(filePath, PLAN_WITH_DEPS)

    // --json should take precedence over --format dot
    const result = await runCLI(['graph', filePath, '--json', '--format', 'dot'])
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.a).toEqual([{ target: 'b', type: 'fs' }])
    expect(result.exitCode).toBe(0)
  })

  it('DOT output handles plans with no dependencies', async () => {
    const filePath = join(tmpDir, 'dot-nodeps.plan')
    await writeFile(filePath, PLAN_NO_DEPS)

    const result = await runCLI(['graph', filePath, '--format', 'dot'])
    expect(result.stdout).toContain('digraph dependencies {')
    expect(result.stdout).toContain('"x"')
    expect(result.stdout).toContain('"y"')
    // No edges
    expect(result.stdout).not.toContain('->')
    expect(result.exitCode).toBe(0)
  })
})
