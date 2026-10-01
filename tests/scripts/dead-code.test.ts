import { spawnSync } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { runDeadCode } from '../../scripts/dead-code'
import budgets from '../../quality-budgets.json'

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

beforeEach(() => vi.mocked(spawnSync).mockReset().mockReturnValue(success))

test.each([false, true])(
  'runs installed Knip with absolute executable paths (production=%s)',
  (production) => {
    expect(runDeadCode(production)).toBe(0)
    const call = vi.mocked(spawnSync).mock.calls[0]
    expect(call?.[0]).toBe(process.execPath)
    const args = call?.[1] as string[]
    expect(isAbsolute(args[0] ?? '')).toBe(true)
    expect(args[0]).toMatch(/knip\/bin\/knip\.js$/)
    expect(args).toContain(
      String(production ? budgets.deadCode.production : budgets.deadCode.full)
    )
    expect(args.includes('--production')).toBe(production)
  }
)

test('propagates findings, termination and startup failure to the command exit code', () => {
  vi.mocked(spawnSync).mockReturnValueOnce({ ...success, status: 1 })
  expect(runDeadCode(false)).toBe(1)
  vi.mocked(spawnSync).mockReturnValueOnce({
    ...success,
    status: null,
    signal: 'SIGTERM',
  })
  expect(runDeadCode(false)).toBe(1)
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    vi.mocked(spawnSync).mockReturnValueOnce({
      ...success,
      status: null,
      error: new Error('EACCES'),
    })
    expect(runDeadCode(false)).toBe(1)
    expect(error).toHaveBeenCalledWith('Could not start Knip')
  } finally {
    error.mockRestore()
  }
})
