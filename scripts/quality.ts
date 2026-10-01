import { spawnSync } from 'node:child_process'
import { accessSync, constants, realpathSync } from 'node:fs'
import { delimiter, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
  const pnpm = findPnpm()
  const script = /\.[cm]?js$/.test(pnpm)
  // Resolve once, then launch absolute paths; use this Node for JS launchers.
  const executable = script ? process.execPath : pnpm
  const prefix = script ? [pnpm] : []
  const checkEnv = { ...process.env }
  delete checkEnv.SONAR_TOKEN
  for (const args of [
    ['quality:local'],
    [
      'exec',
      'sonar-scanner-npm',
      `-Dsonar.host.url=${host}`,
      `-Dsonar.projectKey=${project}`,
    ],
  ]) {
    const isScanner = args[0] === 'exec'
    const result = spawnSync(executable, [...prefix, ...args], {
      stdio: 'inherit',
      env: isScanner ? { ...checkEnv, SONAR_TOKEN: token } : checkEnv,
    })
    if (result.error) {
      console.error(`Could not start pnpm ${args.join(' ')}.`)
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
