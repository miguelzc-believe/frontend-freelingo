import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCrap } from '../../scripts/crap'

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-crap-gate-'))
  mkdirSync(join(directory, 'src'))
  mkdirSync(join(directory, 'coverage'))
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({ include: ['src/**/*.ts'] })
  )
  writeFileSync(join(directory, 'coverage/coverage-final.json'), '{}')
  return { directory, source: join(directory, 'src/example.ts') }
}

const riskySource = [
  'export function risky(value: number) {',
  ...Array.from(
    { length: 100 },
    (_, index) => `  if (value === ${index}) return ${index}`
  ),
  '  return -1',
  '}',
].join('\n')

test('the CRAP command rejects risky untested code and accepts a small function', () => {
  const { directory, source } = createFixture()
  const repository = process.cwd()
  const run = () =>
    spawnSync(
      process.execPath,
      [
        '--import',
        join(repository, 'node_modules/tsx/dist/loader.mjs'),
        join(repository, 'scripts/crap.ts'),
      ],
      { cwd: directory, encoding: 'utf8' }
    )
  try {
    writeFileSync(source, 'export function simple() { return 1 }')
    expect(run().status).toBe(0)
    writeFileSync(source, riskySource)
    const failure = run()
    expect(failure.status).toBe(1)
    expect(failure.stderr).toContain('CRAP exceeds the reviewed legacy budget')
    const report: { maxCrap: number } = JSON.parse(
      readFileSync(join(directory, 'reports/quality/crap.json'), 'utf8')
    )
    expect(report.maxCrap).toBeGreaterThan(10000)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CRAP enforces both legacy caps while retaining explicit report-only and empty-source behavior', async () => {
  const { directory, source } = createFixture()
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    writeFileSync(source, 'export function simple() { return 1 }')
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)
    try {
      expect(await runCrap()).toBe(0)
    } finally {
      cwd.mockRestore()
    }
    writeFileSync(source, riskySource)
    expect(await runCrap(directory)).toBe(1)
    expect(await runCrap(directory, true)).toBe(0)
    writeFileSync(
      source,
      Array.from({ length: 100 }, (_, index) =>
        [
          `export function risk${index}(value: number) {`,
          ...Array.from(
            { length: 6 },
            (_, value) => `  if (value === ${value}) return ${value}`
          ),
          '  return -1',
          '}',
        ].join('\n')
      ).join('\n')
    )
    expect(await runCrap(directory)).toBe(1)
    writeFileSync(source, 'export interface Empty { value: number }')
    expect(await runCrap(directory)).toBe(0)
    rmSync(join(directory, 'coverage/coverage-final.json'))
    await expect(runCrap(directory)).rejects.toThrow('ENOENT')
  } finally {
    log.mockRestore()
    error.mockRestore()
    rmSync(directory, { recursive: true, force: true })
  }
})
