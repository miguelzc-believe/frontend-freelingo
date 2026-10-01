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

test('the CRAP command rejects risky untested code and accepts a small function', () => {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-crap-gate-'))
  const repository = process.cwd()
  mkdirSync(join(directory, 'src'))
  mkdirSync(join(directory, 'coverage'))
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({ include: ['src/**/*.ts'] })
  )
  writeFileSync(join(directory, 'coverage/coverage-final.json'), '{}')
  const source = join(directory, 'src/example.ts')
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
    writeFileSync(
      source,
      [
        'export function risky(value: number) {',
        ...Array.from(
          { length: 100 },
          (_, index) => `  if (value === ${index}) return ${index}`
        ),
        '  return -1',
        '}',
      ].join('\n')
    )
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
