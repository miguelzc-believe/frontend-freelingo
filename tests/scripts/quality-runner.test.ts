import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { prepareDuplicationScan } from '../../scripts/duplication'
import { findPnpm, runQuality } from '../../scripts/quality'

vi.mock('../../scripts/duplication', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../scripts/duplication')>()
  return { ...actual, prepareDuplicationScan: vi.fn() }
})

const revision = 'a'.repeat(40)

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const spawnSync = vi.fn()
  return { ...actual, spawnSync, default: { ...actual, spawnSync } }
})

const success = {
  pid: 1,
  output: [],
  stdout: Buffer.alloc(0),
  stderr: Buffer.alloc(0),
  status: 0,
  signal: null,
}
let directory: string
let launcher: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'freelingo-quality-runner-'))
  launcher = join(directory, 'pnpm.js')
  writeFileSync(launcher, '', { mode: 0o700 })
  symlinkSync(launcher, join(directory, 'pnpm'))
  vi.stubEnv('PATH', directory)
  vi.stubEnv('npm_execpath', '')
  vi.stubEnv('SONAR_TOKEN', '  test-only-token  ')
  vi.stubEnv('SONAR_HOST_URL', '  https://sonar.example.test  ')
  vi.stubEnv('SONAR_PROJECT_KEY', '  example-project  ')
  vi.mocked(spawnSync).mockReset().mockReturnValue(success)
  vi.mocked(prepareDuplicationScan).mockReset().mockReturnValue(revision)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(directory, { recursive: true, force: true })
})

test('runs local checks, a revision-bound scanner and the global guard without Stryker, isolating the token', () => {
  expect(runQuality()).toBe(0)
  const calls = vi.mocked(spawnSync).mock.calls
  expect(calls.map((call) => call[0])).toEqual(Array(3).fill(process.execPath))
  expect(calls.map((call) => call[1])).toEqual([
    [launcher, 'quality:local'],
    [
      launcher,
      'exec',
      'sonar-scanner-npm',
      '-Dsonar.host.url=https://sonar.example.test',
      '-Dsonar.projectKey=example-project',
      '-Dsonar.verbose=false',
      '-Dsonar.log.level=INFO',
      `-Dsonar.scm.revision=${revision}`,
    ],
    [launcher, 'quality:duplication', revision],
  ])
  expect(calls[0]?.[2]?.env?.SONAR_TOKEN).toBeUndefined()
  expect(calls[1]?.[2]?.env?.SONAR_TOKEN).toBe('test-only-token')
  expect(calls[2]?.[2]?.env?.SONAR_TOKEN).toBe('test-only-token')
  expect(prepareDuplicationScan).toHaveBeenCalledOnce()
  expect(
    vi.mocked(prepareDuplicationScan).mock.invocationCallOrder[0]
  ).toBeGreaterThan(vi.mocked(spawnSync).mock.invocationCallOrder[0] ?? 0)
  expect(
    vi.mocked(prepareDuplicationScan).mock.invocationCallOrder[0]
  ).toBeLessThan(vi.mocked(spawnSync).mock.invocationCallOrder[1] ?? 0)
})

test.each(['DEBUG', 'TRACE'])(
  'overrides inherited verbose/debug logging (%s) before scanner bootstrap',
  (level) => {
    vi.stubEnv('SONAR_VERBOSE', 'true')
    vi.stubEnv('SONAR_LOG_LEVEL', level)
    expect(runQuality()).toBe(0)
    const scanner = vi.mocked(spawnSync).mock.calls[1]
    expect(scanner?.[1]).toEqual(
      expect.arrayContaining([
        '-Dsonar.verbose=false',
        '-Dsonar.log.level=INFO',
      ])
    )
    expect(scanner?.[2]?.env).toMatchObject({
      SONAR_VERBOSE: 'false',
      SONAR_LOG_LEVEL: 'INFO',
      SONAR_TOKEN: 'test-only-token',
    })
  }
)

test.each([
  'not-a-url',
  'file:///tmp/server',
  'https://user:test-only-token@sonar.example.test',
  'https://sonar.example.test?token=test-only-token',
  'https://sonar.example.test#test-only-token',
])(
  'rejects unsafe nonblank connection %# before launching any phase without leaking it',
  (host) => {
    vi.stubEnv('SONAR_HOST_URL', host)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(runQuality()).toBe(1)
    expect(spawnSync).not.toHaveBeenCalled()
    expect(prepareDuplicationScan).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Invalid SonarQube server URL.'
    )
    expect(JSON.stringify(error.mock.calls)).not.toContain(host)
    expect(JSON.stringify(error.mock.calls)).not.toContain('test-only-token')
  }
)

test.each([
  { phase: 0, status: 5 },
  { phase: 1, status: 3 },
  { phase: 2, status: 1 },
  { phase: 0, status: null },
  { phase: 1, status: null },
  { phase: 2, status: null },
])(
  'stops after failed phase $phase with status $status',
  ({ phase, status }) => {
    for (let index = 0; index < phase; index++) {
      vi.mocked(spawnSync).mockReturnValueOnce(success)
    }
    vi.mocked(spawnSync).mockReturnValueOnce({ ...success, status })
    expect(runQuality()).toBe(status ?? 1)
    expect(spawnSync).toHaveBeenCalledTimes(phase + 1)
  }
)

test('rejects dirty source before starting the scanner or guard', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(prepareDuplicationScan).mockImplementationOnce(() => {
    throw new Error('unsafe diagnostic with test-only-token')
  })
  expect(runQuality()).toBe(1)
  expect(spawnSync).toHaveBeenCalledOnce()
  expect(error).toHaveBeenCalledWith(
    'Could not prepare SonarQube scan: require clean tracked files, no untracked authored files and a removable previous task report.'
  )
})

test.each([0, 1, 2])(
  'reports phase %s startup failure without exposing the token',
  (phase) => {
    for (let index = 0; index < phase; index++) {
      vi.mocked(spawnSync).mockReturnValueOnce(success)
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(spawnSync).mockReturnValueOnce({
      ...success,
      status: null,
      error: new Error('EACCES'),
    })
    expect(runQuality()).toBe(1)
    const label = [
      'local quality checks',
      'SonarQube scanner',
      'global duplication guard',
    ][phase]
    expect(error).toHaveBeenCalledWith(`Could not start ${label}.`)
    expect(JSON.stringify(error.mock.calls)).not.toContain('sonar.example.test')
    expect(JSON.stringify(error.mock.calls)).not.toContain('test-only-token')
  }
)

test.each(['SONAR_TOKEN', 'SONAR_HOST_URL', 'SONAR_PROJECT_KEY'])(
  'requires %s in the environment even when legacy token files exist',
  (variable) => {
    vi.stubEnv(variable, '   ')
    vi.stubEnv('XDG_CONFIG_HOME', directory)
    mkdirSync(join(directory, 'freelingo'))
    const tokenFile = join(directory, 'freelingo/sonar-token')
    writeFileSync(tokenFile, 'file-token\n')
    vi.stubEnv('SONAR_TOKEN_FILE', tokenFile)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(runQuality()).toBe(1)
    expect(spawnSync).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      `Missing SonarQube environment variables: ${variable}.`
    )
  }
)

test('resolves absolute launchers and ignores relative PATH entries', () => {
  vi.stubEnv('npm_execpath', launcher)
  expect(findPnpm()).toBe(launcher)
  vi.stubEnv('npm_execpath', 'relative-launcher')
  vi.stubEnv(
    'PATH',
    ['relative', '', join(directory, 'missing'), directory].join(delimiter)
  )
  expect(findPnpm()).toBe(launcher)
  vi.stubEnv('PATH', '')
  expect(findPnpm).toThrow('Could not locate an absolute pnpm executable')
})

test('supports an absolute standalone pnpm executable', () => {
  rmSync(join(directory, 'pnpm'))
  writeFileSync(join(directory, 'pnpm'), '', { mode: 0o700 })
  expect(runQuality()).toBe(0)
  expect(vi.mocked(spawnSync).mock.calls[0]?.slice(0, 2)).toEqual([
    join(directory, 'pnpm'),
    ['quality:local'],
  ])
})
