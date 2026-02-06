import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = join(import.meta.dirname, '..', '..', 'src', 'cli', 'index.ts')

const VALID_PLAN = `
version: "1.0.0"
project: Test
tasks:
  - id: a
    title: Task A
`

const INVALID_PLAN = `
version: "1.0.0"
tasks:
  - title: Missing ID
`

const BAD_YAML = `
version: "1.0.0"
project: Test
tasks:
  - id: a
    title: [invalid
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

describe('partial validate', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'partial-cli-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('prints "Valid" and exits 0 for a valid file', async () => {
    const filePath = join(tmpDir, 'valid.plan')
    await writeFile(filePath, VALID_PLAN)

    const result = await runCLI(['validate', filePath])
    expect(result.stdout.trim()).toBe('Valid')
    expect(result.exitCode).toBe(0)
  })

  it('prints error and exits 1 for an invalid file', async () => {
    const filePath = join(tmpDir, 'invalid.plan')
    await writeFile(filePath, INVALID_PLAN)

    const result = await runCLI(['validate', filePath])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Validation error')
  })

  it('prints error and exits 1 for malformed YAML', async () => {
    const filePath = join(tmpDir, 'bad.plan')
    await writeFile(filePath, BAD_YAML)

    const result = await runCLI(['validate', filePath])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('prints error to stderr and exits 2 for missing file', async () => {
    const result = await runCLI(['validate', join(tmpDir, 'nonexistent.plan')])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('File not found')
  })

  it('outputs JSON with --json flag for valid file', async () => {
    const filePath = join(tmpDir, 'json-valid.plan')
    await writeFile(filePath, VALID_PLAN)

    const result = await runCLI(['validate', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed).toEqual({ valid: true })
    expect(result.exitCode).toBe(0)
  })

  it('outputs JSON with --json flag for invalid file', async () => {
    const filePath = join(tmpDir, 'json-invalid.plan')
    await writeFile(filePath, INVALID_PLAN)

    const result = await runCLI(['validate', filePath, '--json'])
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.valid).toBe(false)
    expect(parsed.error).toBeDefined()
    expect(result.exitCode).toBe(1)
  })

  it('outputs JSON with --json flag for missing file', async () => {
    const result = await runCLI(['validate', join(tmpDir, 'missing.plan'), '--json'])
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.valid).toBe(false)
    expect(parsed.error).toContain('File not found')
    expect(result.exitCode).toBe(2)
  })

  it('reads from stdin when no file is given', async () => {
    const result = await runCLI(['validate'], VALID_PLAN)
    expect(result.stdout.trim()).toBe('Valid')
    expect(result.exitCode).toBe(0)
  })

  it('validates stdin with --json flag', async () => {
    const result = await runCLI(['validate', '--json'], VALID_PLAN)
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed).toEqual({ valid: true })
    expect(result.exitCode).toBe(0)
  })

  it('suppresses output with --quiet flag for valid file', async () => {
    const filePath = join(tmpDir, 'quiet.plan')
    await writeFile(filePath, VALID_PLAN)

    const result = await runCLI(['validate', filePath, '--quiet'])
    expect(result.stdout.trim()).toBe('')
    expect(result.exitCode).toBe(0)
  })
})

describe('partial global flags', () => {
  it('prints version with --version', async () => {
    const result = await runCLI(['--version'])
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
    expect(result.exitCode).toBe(0)
  })

  it('prints usage with --help', async () => {
    const result = await runCLI(['--help'])
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('validate')
    expect(result.exitCode).toBe(0)
  })

  it('prints validate help with validate --help', async () => {
    const result = await runCLI(['validate', '--help'])
    expect(result.stdout).toContain('validate')
    expect(result.stdout).toContain('Exit codes')
    expect(result.exitCode).toBe(0)
  })

  it('prints error for unknown command', async () => {
    const result = await runCLI(['nonexistent'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Unknown command')
  })

  it('prints usage when no command given', async () => {
    // Need to ensure stdin is closed so it doesn't hang
    const result = await runCLI([])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Usage:')
  })
}, 30000)
