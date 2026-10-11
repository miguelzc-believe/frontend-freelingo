// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import {
  prepareDuplicationScan,
  readCleanRevision,
  runDuplication,
  validateSonarHost,
} from '../../scripts/duplication'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execFileSync: vi.fn() }
})
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readFileSync: vi.fn(), rmSync: vi.fn() }
})
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }))

const revision = 'a'.repeat(40)
const project = 'example-project'
const taskId = 'task-123'
const report = `projectKey=${project}\nserverUrl=https://sonar.example.test\nceTaskId=${taskId}\n`
const fetchMock = vi.fn<typeof fetch>()
let now: number

function task(overrides: Record<string, unknown> = {}) {
  return {
    task: {
      id: taskId,
      componentKey: project,
      status: 'SUCCESS',
      analysisId: 'analysis-123',
      scannerContext: `Project scanner properties:\n  - sonar.scm.revision=${revision}\n  - sonar.projectKey=${project}\n`,
      ...overrides,
    },
  }
}

function measures(value: unknown = '0.9') {
  return {
    component: {
      key: project,
      qualifier: 'TRK',
      measures: [{ metric: 'duplicated_lines_density', value }],
    },
  }
}

function respond(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function queue(
  taskPayload: unknown = task(),
  metricPayload: unknown = measures()
) {
  fetchMock.mockResolvedValueOnce(respond(taskPayload))
  fetchMock.mockResolvedValueOnce(respond(metricPayload))
}

beforeEach(() => {
  now = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubEnv('SONAR_TOKEN', '  test-only-token  ')
  vi.stubEnv('SONAR_HOST_URL', '  https://sonar.example.test/  ')
  vi.stubEnv('SONAR_PROJECT_KEY', `  ${project}  `)
  vi.mocked(execFileSync)
    .mockReset()
    .mockImplementation((_file, args) =>
      args?.[0] === 'rev-parse' ? `${revision}\n` : ''
    )
  vi.mocked(readFileSync).mockReset().mockReturnValue(report)
  vi.mocked(rmSync).mockReset()
  vi.mocked(delay)
    .mockReset()
    .mockImplementation(async (ms) => {
      now += ms ?? 0
    })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test.each(['0', '0.9', '0.99', '0.999999'])(
  'passes global density %s below 1 percent',
  async (density) => {
    queue(task(), measures(density))
    expect(await runDuplication(revision)).toBe(0)
    expect(console.log).toHaveBeenCalledWith(
      `Global duplicated_lines_density is ${Number(density)}% (< 1%); validated latest project measures, not an atomic task snapshot.`
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)))
    expect(urls.map((url) => url.pathname)).toEqual([
      '/api/ce/task',
      '/api/measures/component',
    ])
    expect(urls[0]?.searchParams.get('id')).toBe(taskId)
    expect(urls[0]?.searchParams.get('additionalFields')).toBe('scannerContext')
    expect(urls[1]?.searchParams.get('component')).toBe(project)
    expect(urls[1]?.searchParams.get('metricKeys')).toBe(
      'duplicated_lines_density'
    )
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({
        headers: { Authorization: 'Bearer test-only-token' },
        redirect: 'error',
        cache: 'no-store',
      })
      expect(options?.signal).toBeInstanceOf(AbortSignal)
    }
  }
)

test.each(['1', '1.0', '1.1', '100'])(
  'fails global density %s even without a failing new-code gate',
  async (density) => {
    queue(task(), measures(density))
    expect(await runDuplication()).toBe(1)
    expect(console.error).toHaveBeenCalledWith(
      `Global duplicated_lines_density is ${Number(density)}%; it must be strictly below 1%.`
    )
  }
)

test.each([
  undefined,
  null,
  '',
  ' ',
  'NaN',
  'Infinity',
  '-1',
  '101',
  '0.9%',
  '0x0',
  '9e-1',
  ' 0.9',
  '0.9 ',
  '1,0',
  0.9,
  {},
  '9'.repeat(400),
])('rejects missing or malformed density %j', async (value) => {
  const payload = measures()
  payload.component.measures[0]!.value = value
  queue(task(), payload)
  expect(await runDuplication()).toBe(1)
  expect(console.error).toHaveBeenCalledWith(
    'Missing or malformed global duplicated_lines_density metric.'
  )
})

test.each([
  {},
  null,
  { component: null },
  { component: { ...measures().component, key: 'another-project' } },
  { component: { ...measures().component, qualifier: 'FIL' } },
  { component: { ...measures().component, measures: undefined } },
  { component: { ...measures().component, measures: {} } },
  { component: { ...measures().component, measures: [null] } },
  { component: { ...measures().component, measures: [] } },
  {
    component: {
      ...measures().component,
      measures: [{ metric: 'new_duplicated_lines_density', value: '0.0' }],
    },
  },
  {
    component: {
      ...measures().component,
      measures: [
        { metric: 'duplicated_lines_density', period: { value: '0.0' } },
      ],
    },
  },
  {
    component: {
      ...measures().component,
      measures: [
        { metric: 'duplicated_lines_density', value: '0.0' },
        { metric: 'duplicated_lines_density', value: '0.9' },
      ],
    },
  },
])(
  'fails closed for malformed, non-global or mismatched measures %#',
  async (payload) => {
    queue(task(), payload)
    expect(await runDuplication()).toBe(1)
    expect(console.log).not.toHaveBeenCalled()
  }
)

test('polls only the report task through pending and processing until success', async () => {
  fetchMock.mockResolvedValueOnce(respond(task({ status: 'PENDING' })))
  fetchMock.mockResolvedValueOnce(respond(task({ status: 'IN_PROGRESS' })))
  queue()
  expect(await runDuplication()).toBe(0)
  expect(delay).toHaveBeenCalledTimes(2)
  expect(
    fetchMock.mock.calls
      .slice(0, 3)
      .every(([url]) => new URL(String(url)).searchParams.get('id') === taskId)
  ).toBe(true)
})

test('times out pending processing without reading measures', async () => {
  fetchMock.mockImplementation(async () => respond(task({ status: 'PENDING' })))
  expect(await runDuplication()).toBe(1)
  expect(now).toBe(300_000)
  expect(console.error).toHaveBeenCalledWith(
    'Timed out waiting for the SonarQube compute task.'
  )
  expect(
    fetchMock.mock.calls.every(
      ([url]) => new URL(String(url)).pathname === '/api/ce/task'
    )
  ).toBe(true)
})

test.each([
  {},
  null,
  { task: null },
  task({ id: 'other-task' }),
  task({ componentKey: 'another-project' }),
  task({ status: 'FAILED', errorMessage: 'test-only-token' }),
  task({ status: 'CANCELED' }),
  task({ status: 'UNKNOWN' }),
  task({ status: undefined }),
  task({ analysisId: undefined }),
  task({ analysisId: ' ' }),
  task({ scannerContext: undefined }),
  task({ scannerContext: {} }),
  task({ scannerContext: 'sonar.scm.revision=HEAD' }),
  task({ scannerContext: `sonar.scm.revision=${'b'.repeat(40)}` }),
  task({
    scannerContext: `sonar.scm.revision=${revision}\nsonar.scm.revision=${revision}`,
  }),
  task({
    scannerContext: `sonar.scm.revision=\nsonar.scm.revision=${revision}`,
  }),
  task({
    scannerContext: `sonar.scm.revision=wrong value\nsonar.scm.revision=${revision}`,
  }),
  task({ scannerContext: `other.sonar.scm.revision=${revision}` }),
  // Do not trust automatic SCM detection in place of the explicit scanner property.
  task({ scannerContext: `sonar.analysis.revision=${revision}` }),
])(
  'rejects unsuccessful, mismatched or stale task %# before reading measures',
  async (payload) => {
    queue(payload)
    expect(await runDuplication(revision)).toBe(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'test-only-token'
    )
  }
)

test('accepts explicit revision in plain or CRLF scanner context', async () => {
  queue(task({ scannerContext: `sonar.scm.revision=${revision}\r\n` }))
  expect(await runDuplication()).toBe(0)
})

test.each([
  '',
  'ceTaskId=task-123',
  `${report}ceTaskId=other-task\n`,
  report.replace(project, 'another-project'),
  report.replace('sonar.example.test', 'other.example.test'),
  report.replace(taskId, 'invalid/task'),
  `${report}malformed-line`,
])(
  'rejects missing or malformed scanner report %# without HTTP access',
  async (text) => {
    vi.mocked(readFileSync).mockReturnValue(text)
    expect(await runDuplication()).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

test('requires report-task.txt and never follows its ceTaskUrl', async () => {
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw new Error('ENOENT')
  })
  expect(await runDuplication()).toBe(1)
  expect(fetchMock).not.toHaveBeenCalled()
  vi.mocked(readFileSync).mockReturnValue(
    `${report}ceTaskUrl=https://evil.example.test/steal\n`
  )
  queue()
  expect(await runDuplication()).toBe(0)
  expect(
    fetchMock.mock.calls.every(
      ([url]) => new URL(String(url)).hostname === 'sonar.example.test'
    )
  ).toBe(true)
})

test('supports a SonarQube context path and report comments', async () => {
  vi.stubEnv('SONAR_HOST_URL', 'https://sonar.example.test/sonar/')
  vi.mocked(readFileSync).mockReturnValue(
    `# comment\n! another comment\n\n${report.replace('sonar.example.test', 'sonar.example.test/sonar/')}`
  )
  queue()
  expect(await runDuplication()).toBe(0)
  expect(
    fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)
  ).toEqual(['/sonar/api/ce/task', '/sonar/api/measures/component'])
})

test.each(['SONAR_TOKEN', 'SONAR_HOST_URL', 'SONAR_PROJECT_KEY'])(
  'requires %s without reading credentials from files',
  async (variable) => {
    vi.stubEnv(variable, ' ')
    expect(await runDuplication()).toBe(1)
    expect(readFileSync).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

test.each([
  'not-a-url',
  'file:///tmp/server',
  'https://user:test-only-token@sonar.example.test',
  'https://sonar.example.test?token=test-only-token',
  'https://sonar.example.test#fragment',
])('rejects unsafe server URL %s without leaking credentials', async (host) => {
  vi.stubEnv('SONAR_HOST_URL', host)
  expect(await runDuplication()).toBe(1)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'test-only-token'
  )
})

test.each([0, 1])(
  'fails closed on phase %s HTTP errors without logging bodies',
  async (phase) => {
    if (phase === 1) fetchMock.mockResolvedValueOnce(respond(task()))
    fetchMock.mockResolvedValueOnce(respond({ error: 'test-only-token' }, 403))
    expect(await runDuplication()).toBe(1)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'test-only-token'
    )
  }
)

test.each([0, 1])(
  'fails closed on phase %s network errors and invalid JSON',
  async (phase) => {
    if (phase === 1) fetchMock.mockResolvedValueOnce(respond(task()))
    fetchMock.mockRejectedValueOnce(new Error('test-only-token'))
    expect(await runDuplication()).toBe(1)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'test-only-token'
    )
    if (phase === 1) fetchMock.mockResolvedValueOnce(respond(task()))
    fetchMock.mockResolvedValueOnce(
      new Response('test-only-token', { status: 200 })
    )
    expect(await runDuplication()).toBe(1)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'test-only-token'
    )
  }
)

test.each([
  { tracked: ' M src/example.ts\n', authored: '' },
  { tracked: ' M docs/example.md\n', authored: '' },
  { tracked: '', authored: '?? scripts/new.ts\n' },
  { tracked: '', authored: '?? src/example.new.ts\n' },
  { tracked: '', authored: '?? tests/new.test.ts\n' },
  { tracked: '', authored: '?? messages/new.json\n' },
  { tracked: ' M package.json\n', authored: '' },
])(
  'rejects tracked edits globally and untracked authored files %#',
  async ({ tracked, authored }) => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce(revision)
      .mockReturnValueOnce(tracked)
      .mockReturnValueOnce(authored)
    expect(await runDuplication()).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      'SonarQube revision validation requires clean tracked files and no untracked authored source, tests or configuration.'
    )
  }
)

test('rejects a mismatched expected HEAD before any network request', async () => {
  expect(await runDuplication('b'.repeat(40))).toBe(1)
  expect(fetchMock).not.toHaveBeenCalled()
})

test.each(['changed-head', 'dirty-worktree'])(
  'revalidates the worktree after reading latest measures: %s',
  async (change) => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce(revision)
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValueOnce(
        change === 'changed-head' ? 'b'.repeat(40) : revision
      )
      .mockReturnValueOnce(
        change === 'dirty-worktree' ? ' M src/example.ts' : ''
      )
      .mockReturnValueOnce('')
    queue()
    expect(await runDuplication(revision)).toBe(1)
    expect(console.log).not.toHaveBeenCalled()
  }
)

test('verifies full HEAD, global tracked edits and scoped authored files without exposing the token', () => {
  expect(readCleanRevision()).toBe(revision)
  const calls = vi.mocked(execFileSync).mock.calls
  expect(calls[0]?.slice(0, 2)).toEqual([
    'git',
    ['rev-parse', '--verify', 'HEAD'],
  ])
  expect(calls[1]?.slice(0, 2)).toEqual([
    'git',
    ['status', '--porcelain=v1', '--untracked-files=no'],
  ])
  expect(calls[2]?.[1]?.slice(0, 4)).toEqual([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
  ])
  expect(calls[2]?.[1]?.slice(4)).toEqual(
    expect.arrayContaining([
      'src',
      'scripts',
      'tests',
      'messages',
      '.github',
      'package.json',
      'pnpm-lock.yaml',
      'sonar-project.properties',
      ':(top,glob)*.ts',
      ':(top,glob)*.mjs',
    ])
  )
  for (const call of calls) {
    expect(call[2]?.env?.SONAR_TOKEN).toBeUndefined()
  }
})

test('permits and preserves unrelated untracked .codegraph data by scoping untracked checks', async () => {
  vi.mocked(execFileSync).mockImplementation((_file, args) => {
    if (args?.[0] === 'rev-parse') return revision
    // An accidental global untracked check would see this pre-existing data.
    if (args?.includes('--untracked-files=all') && !args.includes('--')) {
      return '?? .codegraph/local-data\n'
    }
    return ''
  })
  queue()
  expect(await runDuplication()).toBe(0)
  expect(rmSync).not.toHaveBeenCalled()
  expect(
    vi
      .mocked(execFileSync)
      .mock.calls.every((call) => !call[1]?.includes('.codegraph'))
  ).toBe(true)
})

test.each(['short', '', 'A'.repeat(40)])(
  'rejects invalid full Git revision %s',
  (value) => {
    vi.mocked(execFileSync).mockReturnValueOnce(value)
    expect(readCleanRevision).toThrow('Git HEAD is not a valid full revision.')
  }
)

test('supports full SHA-256 Git revisions', () => {
  vi.mocked(execFileSync).mockReturnValueOnce('a'.repeat(64))
  expect(readCleanRevision()).toBe('a'.repeat(64))
})

test('reports Git failures safely', async () => {
  vi.mocked(execFileSync).mockImplementationOnce(() => {
    throw new Error('test-only-token')
  })
  expect(await runDuplication()).toBe(1)
  expect(console.error).toHaveBeenCalledWith(
    'Could not verify the Git revision and worktree.'
  )
})

test('preparation removes stale reports only after confirming a clean revision', () => {
  expect(prepareDuplicationScan()).toBe(revision)
  expect(rmSync).toHaveBeenCalledWith('.scannerwork/report-task.txt', {
    force: true,
  })
  expect(vi.mocked(rmSync).mock.invocationCallOrder[0]).toBeGreaterThan(
    vi.mocked(execFileSync).mock.invocationCallOrder[2] ?? 0
  )
  vi.mocked(rmSync).mockClear()
  vi.mocked(execFileSync)
    .mockReturnValueOnce(revision)
    .mockReturnValueOnce(' M src/example.ts')
  expect(prepareDuplicationScan).toThrow('requires clean tracked files')
  expect(rmSync).not.toHaveBeenCalled()
})

test.each([
  '',
  'not-a-url',
  'https://user:test-only-token@sonar.example.test',
  'https://sonar.example.test?token=test-only-token',
  'https://sonar.example.test#test-only-token',
])(
  'preparation validates connection %# before Git or report changes without requiring a token',
  (host) => {
    vi.stubEnv('SONAR_HOST_URL', host)
    vi.stubEnv('SONAR_TOKEN', '')
    expect(prepareDuplicationScan).toThrow('Invalid SonarQube server URL.')
    expect(execFileSync).not.toHaveBeenCalled()
    expect(rmSync).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

test('safe connection validation and valid preparation work without the token', () => {
  vi.stubEnv('SONAR_TOKEN', '')
  expect(validateSonarHost('https://sonar.example.test/sonar/')).toBe(
    'https://sonar.example.test/sonar'
  )
  expect(prepareDuplicationScan()).toBe(revision)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('preparation fails if it cannot invalidate the previous report', () => {
  vi.mocked(rmSync).mockImplementationOnce(() => {
    throw new Error('EACCES')
  })
  expect(prepareDuplicationScan).toThrow(
    'Could not remove the previous scanner task report.'
  )
})

test('does not print unexpected exception details', async () => {
  const response = respond(task())
  Object.defineProperty(response, 'ok', {
    get() {
      throw new Error('test-only-token')
    },
  })
  fetchMock.mockResolvedValueOnce(response)
  expect(await runDuplication()).toBe(1)
  expect(console.error).toHaveBeenCalledWith(
    'Could not validate global SonarQube duplication.'
  )
})
