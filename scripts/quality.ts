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

export function runQuality() {
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
    return 1
  }
  try {
    validateSonarHost(host || '')
  } catch {
    console.error('Invalid SonarQube server URL.')
    return 1
  }
  const pnpm = findPnpm()
  const script = /\.[cm]?js$/.test(pnpm)
  // Resolve once, then launch absolute paths; use this Node for JS launchers.
  const executable = script ? process.execPath : pnpm
  const prefix = script ? [pnpm] : []
  const checkEnv = { ...process.env }
  delete checkEnv.SONAR_TOKEN
  let revision = ''
  for (const args of [
    ['quality:local'],
    [
      'exec',
      'sonar-scanner-npm',
      `-Dsonar.host.url=${host}`,
      `-Dsonar.projectKey=${project}`,
      '-Dsonar.verbose=false',
      '-Dsonar.log.level=INFO',
    ],
    ['quality:duplication'],
  ]) {
    const isScanner = args[0] === 'exec'
    const isGuard = args[0] === 'quality:duplication'
    if (isScanner) {
      try {
        revision = prepareDuplicationScan()
      } catch {
        console.error(
          'Could not prepare SonarQube scan: require clean tracked files, no untracked authored files and a removable previous task report.'
        )
        return 1
      }
      args.push(`-Dsonar.scm.revision=${revision}`)
    }
    if (isGuard) args.push(revision)
    const result = spawnSync(executable, [...prefix, ...args], {
      stdio: 'inherit',
      env: isScanner
        ? {
            ...checkEnv,
            SONAR_TOKEN: token,
            SONAR_VERBOSE: 'false',
            SONAR_LOG_LEVEL: 'INFO',
          }
        : isGuard
          ? { ...checkEnv, SONAR_TOKEN: token }
          : checkEnv,
    })
    if (result.error) {
      const phase = isScanner
        ? 'SonarQube scanner'
        : isGuard
          ? 'global duplication guard'
          : 'local quality checks'
      console.error(`Could not start ${phase}.`)
      return 1
    }
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = runQuality()
}
