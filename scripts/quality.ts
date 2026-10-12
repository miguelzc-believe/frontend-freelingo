import { spawnSync } from 'node:child_process'
import { accessSync, constants, realpathSync } from 'node:fs'
import { delimiter, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareDuplicationScan, validateSonarHost } from './duplication'

export function findPnpm() {
  const launcher = process.env.npm_execpath
  if (launcher && isAbsolute(launcher)) return realpathSync(launcher)
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    if (!directory || !isAbsolute(directory)) continue
    const candidate = join(directory, 'pnpm')
    try {
      accessSync(candidate, constants.X_OK)
      return realpathSync(candidate)
    } catch {
      // Continue until an installed executable is found.
    }
  }
  throw new Error('Could not locate an absolute pnpm executable')
}

function readSonarConnection() {
  const token = process.env.SONAR_TOKEN?.trim()
  const host = process.env.SONAR_HOST_URL?.trim()
  const project = process.env.SONAR_PROJECT_KEY?.trim()
  const missing = [
    ['SONAR_TOKEN', token],
    ['SONAR_HOST_URL', host],
    ['SONAR_PROJECT_KEY', project],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length) {
    console.error(
      `Missing SonarQube environment variables: ${missing.join(', ')}.`
    )
    return null
  }
  try {
    validateSonarHost(host || '')
  } catch {
    console.error('Invalid SonarQube server URL.')
    return null
  }
  return { token, host, project }
}

function runQualityPhase(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  label: string
) {
  const result = spawnSync(executable, args, { stdio: 'inherit', env })
  if (result.error) {
    console.error(`Could not start ${label}.`)
    return 1
  }
  return result.status ?? 1
}

export function runQuality() {
  const connection = readSonarConnection()
  if (!connection) return 1
  const { token, host, project } = connection
  const pnpm = findPnpm()
  const script = /\.[cm]?js$/.test(pnpm)
  // Resolve once, then launch absolute paths; use this Node for JS launchers.
  const executable = script ? process.execPath : pnpm
  const prefix = script ? [pnpm] : []
  const checkEnv = { ...process.env }
  delete checkEnv.SONAR_TOKEN
  const localStatus = runQualityPhase(
    executable,
    [...prefix, 'quality:local'],
    checkEnv,
    'local quality checks'
  )
  if (localStatus !== 0) return localStatus

  let revision: string
  try {
    revision = prepareDuplicationScan()
  } catch {
    console.error(
      'Could not prepare SonarQube scan: require clean tracked files, no untracked authored files and a removable previous task report.'
    )
    return 1
  }
  const scannerStatus = runQualityPhase(
    executable,
    [
      ...prefix,
      'exec',
      'sonar-scanner-npm',
      `-Dsonar.host.url=${host}`,
      `-Dsonar.projectKey=${project}`,
      '-Dsonar.verbose=false',
      '-Dsonar.log.level=INFO',
      `-Dsonar.scm.revision=${revision}`,
    ],
    {
      ...checkEnv,
      SONAR_TOKEN: token,
      SONAR_VERBOSE: 'false',
      SONAR_LOG_LEVEL: 'INFO',
    },
    'SonarQube scanner'
  )
  if (scannerStatus !== 0) return scannerStatus
  return runQualityPhase(
    executable,
    [...prefix, 'quality:duplication', revision],
    { ...checkEnv, SONAR_TOKEN: token },
    'global duplication guard'
  )
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = runQuality()
}
