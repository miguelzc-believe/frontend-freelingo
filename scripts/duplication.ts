import {
  execFileSync,
  type ExecFileSyncOptionsWithStringEncoding,
} from 'node:child_process'
import {
  accessSync,
  constants,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const reportPath = '.scannerwork/report-task.txt'
const metric = 'duplicated_lines_density'
const processingTimeout = 300_000
const requestTimeout = 10_000

class DuplicationError extends Error {}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function findGit() {
  // Only trust system installation locations, never PATH or relative entries.
  // Resolve symlinks once and launch the resulting absolute executable.
  for (const candidate of ['/usr/bin/git', '/usr/local/bin/git', '/bin/git']) {
    try {
      accessSync(candidate, constants.X_OK)
      return realpathSync(candidate)
    } catch {
      // Continue to the next trusted system installation location.
    }
  }
  throw new DuplicationError(
    'Could not locate Git in a trusted system installation directory.'
  )
}

export function readCleanRevision() {
  const env = { ...process.env }
  delete env.SONAR_TOKEN
  let revision: string
  let trackedStatus: string
  let authoredStatus: string
  try {
    const git = findGit()
    const options: ExecFileSyncOptionsWithStringEncoding = {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    }
    revision = execFileSync(
      git,
      ['rev-parse', '--verify', 'HEAD'],
      options
    ).trim()
    trackedStatus = execFileSync(
      git,
      ['status', '--porcelain=v1', '--untracked-files=no'],
      options
    ).trim()
    authoredStatus = execFileSync(
      git,
      [
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
        '--',
        'src',
        'scripts',
        'tests',
        'messages',
        '.github',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'sonar-project.properties',
        'quality-budgets.json',
        'knip.json',
        'components.json',
        ':(top,glob)*.ts',
        ':(top,glob)*.mjs',
        ':(top,glob)stryker*.json',
        '.gitignore',
        '.prettierrc',
        '.nvmrc',
      ],
      options
    ).trim()
  } catch {
    throw new DuplicationError(
      'Could not verify the Git revision and worktree.'
    )
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) {
    throw new DuplicationError('Git HEAD is not a valid full revision.')
  }
  // Reject all tracked edits plus untracked authored source/tests/config in the
  // explicit scope above. Unrelated local tooling data (e.g. .codegraph/) is not
  // scanned by sonar.sources=src,scripts and must neither be removed nor blocked.
  // Ignored files and untracked files outside this scope are not HEAD-bound.
  if (trackedStatus || authoredStatus) {
    throw new DuplicationError(
      'SonarQube revision validation requires clean tracked files and no untracked authored source, tests or configuration.'
    )
  }
  return revision
}

export function prepareDuplicationScan() {
  // Validate before Git/report preparation or scanner startup, without requiring
  // the token in the preparation process (also used by CI).
  validateSonarHost(process.env.SONAR_HOST_URL?.trim() || '')
  const revision = readCleanRevision()
  try {
    // A successful scanner must write a new report, not reuse a previous task.
    rmSync(reportPath, { force: true })
  } catch {
    throw new DuplicationError(
      'Could not remove the previous scanner task report.'
    )
  }
  return revision
}

export function validateSonarHost(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new DuplicationError('Invalid SonarQube server URL.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new DuplicationError('Invalid SonarQube server URL.')
  }
  let host = url.href
  while (host.endsWith('/')) host = host.slice(0, -1)
  return host
}

function readTaskReport(host: string, project: string) {
  let text: string
  try {
    text = readFileSync(reportPath, 'utf8')
  } catch {
    throw new DuplicationError(
      'Missing or unreadable .scannerwork/report-task.txt; run the scanner first.'
    )
  }
  const properties = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1)
      throw new DuplicationError('Malformed scanner task report.')
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (properties.has(key))
      throw new DuplicationError('Malformed scanner task report.')
    properties.set(key, value)
  }
  const taskId = properties.get('ceTaskId')
  const reportedHost = properties.get('serverUrl')
  if (
    !taskId ||
    !/^[a-zA-Z0-9_-]+$/.test(taskId) ||
    !reportedHost ||
    validateSonarHost(reportedHost) !== host ||
    properties.get('projectKey') !== project
  ) {
    throw new DuplicationError(
      'Scanner task report does not match the configured server and project, or is missing its task ID.'
    )
  }
  return taskId
}

async function requestJson(
  url: URL,
  token: string,
  label: string,
  timeout: number
) {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    })
  } catch {
    throw new DuplicationError(`Could not read SonarQube ${label}.`)
  }
  if (!response.ok) {
    throw new DuplicationError(
      `SonarQube ${label} request failed (HTTP ${response.status}).`
    )
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new DuplicationError(`Malformed SonarQube ${label} JSON.`)
  }
}

function readReportedRevisions(context: string) {
  const revisions: string[] = []
  // Sonar's scannerContext lists properties as plain key=value lines or
  // indented '- key=value' lines. Parse exact keys rather than regex matching.
  for (const line of context.split('\n')) {
    let property = line.trim()
    if (property.startsWith('-')) property = property.slice(1).trimStart()
    const separator = property.indexOf('=')
    if (separator < 0) continue
    if (property.slice(0, separator).trimEnd() === 'sonar.scm.revision') {
      revisions.push(property.slice(separator + 1).trim())
    }
  }
  return revisions
}

function validateSuccessfulTask(task: JsonObject, revision: string) {
  if (typeof task.analysisId !== 'string' || !task.analysisId.trim()) {
    throw new DuplicationError(
      'Successful SonarQube task is missing its analysis ID.'
    )
  }
  if (typeof task.scannerContext !== 'string') {
    throw new DuplicationError(
      'SonarQube task is missing its explicit scanner revision.'
    )
  }
  const revisions = readReportedRevisions(task.scannerContext)
  if (revisions.length !== 1 || revisions[0] !== revision) {
    throw new DuplicationError(
      'SonarQube scanner revision does not match the expected Git HEAD.'
    )
  }
}

function isTaskComplete(
  payload: unknown,
  taskId: string,
  project: string,
  revision: string
) {
  const task = isObject(payload) ? payload.task : undefined
  if (!isObject(task) || task.id !== taskId || task.componentKey !== project) {
    throw new DuplicationError(
      'SonarQube compute task does not match the scanner report and project.'
    )
  }
  if (task.status === 'SUCCESS') {
    validateSuccessfulTask(task, revision)
    return true
  }
  if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
    throw new DuplicationError(
      'SonarQube compute task was unsuccessful or has an invalid status.'
    )
  }
  return false
}

async function verifyTask(
  host: string,
  project: string,
  token: string,
  taskId: string,
  revision: string
) {
  const url = new URL(`${host}/api/ce/task`)
  url.searchParams.set('id', taskId)
  url.searchParams.set('additionalFields', 'scannerContext')
  const deadline = Date.now() + processingTimeout
  while (Date.now() < deadline) {
    const payload = await requestJson(
      url,
      token,
      'compute task',
      Math.min(requestTimeout, deadline - Date.now())
    )
    if (!isTaskComplete(payload, taskId, project, revision)) {
      const remaining = deadline - Date.now()
      if (remaining > 0) await delay(Math.min(1_000, remaining))
      continue
    }
    return
  }
  throw new DuplicationError(
    'Timed out waiting for the SonarQube compute task.'
  )
}

async function readGlobalDensity(host: string, project: string, token: string) {
  const url = new URL(`${host}/api/measures/component`)
  url.searchParams.set('component', project)
  url.searchParams.set('metricKeys', metric)
  const payload = await requestJson(
    url,
    token,
    'global measures',
    requestTimeout
  )
  const component = isObject(payload) ? payload.component : undefined
  if (
    !isObject(component) ||
    component.key !== project ||
    component.qualifier !== 'TRK'
  ) {
    throw new DuplicationError(
      'SonarQube global measures do not match the project.'
    )
  }
  if (
    !Array.isArray(component.measures) ||
    !component.measures.every(isObject)
  ) {
    throw new DuplicationError(
      'Missing or malformed global duplicated_lines_density metric.'
    )
  }
  const measures = component.measures.filter(
    (measure) => measure.metric === metric
  )
  const value: unknown = measures[0]?.value
  if (
    measures.length !== 1 ||
    typeof value !== 'string' ||
    !/^\d+(?:\.\d+)?$/.test(value)
  ) {
    throw new DuplicationError(
      'Missing or malformed global duplicated_lines_density metric.'
    )
  }
  const density = Number(value)
  if (!Number.isFinite(density) || density < 0 || density > 100) {
    throw new DuplicationError(
      'Missing or malformed global duplicated_lines_density metric.'
    )
  }
  return density
}

export async function runDuplication(expectedRevision?: string) {
  try {
    const token = process.env.SONAR_TOKEN?.trim()
    const host = process.env.SONAR_HOST_URL?.trim()
    const project = process.env.SONAR_PROJECT_KEY?.trim()
    if (!token || !host || !project) {
      throw new DuplicationError(
        'SONAR_TOKEN, SONAR_HOST_URL and SONAR_PROJECT_KEY are required for the duplication check.'
      )
    }
    const server = validateSonarHost(host)
    const revision = readCleanRevision()
    if (expectedRevision !== undefined && expectedRevision !== revision) {
      throw new DuplicationError(
        'Expected scanner revision does not match the current Git HEAD.'
      )
    }
    const taskId = readTaskReport(server, project)
    await verifyTask(server, project, token, taskId, revision)
    // This endpoint exposes only latest measures, not measures by analysisId.
    // With an analysis-only token we cannot prove an atomic historical snapshot;
    // callers must serialize scans for this project (including external runners).
    const density = await readGlobalDensity(server, project, token)
    if (readCleanRevision() !== revision) {
      throw new DuplicationError(
        'Git HEAD changed while validating SonarQube duplication.'
      )
    }
    if (density >= 1) {
      throw new DuplicationError(
        `Global duplicated_lines_density is ${density}%; it must be strictly below 1%.`
      )
    }
    console.log(
      `Global duplicated_lines_density is ${density}% (< 1%); validated latest project measures, not an atomic task snapshot.`
    )
    return 0
  } catch (error) {
    // Never log response bodies, scannerContext, credentials or raw network errors.
    console.error(
      error instanceof DuplicationError
        ? error.message
        : 'Could not validate global SonarQube duplication.'
    )
    return 1
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  if (process.argv[2] === '--prepare') {
    try {
      console.log(prepareDuplicationScan())
    } catch (error) {
      console.error(
        error instanceof DuplicationError
          ? error.message
          : 'Could not prepare the SonarQube scan.'
      )
      process.exitCode = 1
    }
  } else {
    process.exitCode = await runDuplication(process.argv[2])
  }
}
