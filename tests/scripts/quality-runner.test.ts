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
import { findPnpm, runQuality } from '../../scripts/quality'

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
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(directory, { recursive: true, force: true })
})

test('runs local checks before upload without starting Stryker, isolating the token to the scanner', () => {
  expect(runQuality()).toBe(0)
  const calls = vi.mocked(spawnSync).mock.calls
  expect(calls.map((call) => call[0])).toEqual(Array(2).fill(process.execPath))
  expect(calls.map((call) => call[1])).toEqual([
    [launcher, 'quality:local'],
    [
      launcher,
      'exec',
      'sonar-scanner-npm',
      '-Dsonar.host.url=https://sonar.example.test',
      '-Dsonar.projectKey=example-project',
    ],
  ])
  expect(calls[0]?.[2]?.env?.SONAR_TOKEN).toBeUndefined()
  expect(calls[1]?.[2]?.env?.SONAR_TOKEN).toBe('test-only-token')
})

test.each([
  { phase: 0, status: 5 },
  { phase: 1, status: 3 },
  { phase: 0, status: null },
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

test('reports startup failure without exposing the token', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(spawnSync).mockReturnValueOnce({
    ...success,
    status: null,
    error: new Error('EACCES'),
  })
  expect(runQuality()).toBe(1)
  expect(error).toHaveBeenCalledWith('Could not start pnpm quality:local.')
})

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
