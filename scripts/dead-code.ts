import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import budgets from '../quality-budgets.json'

export function runDeadCode(production: boolean) {
  const maximum = production
    ? budgets.deadCode.production
    : budgets.deadCode.full
  const require = createRequire(join(process.cwd(), 'package.json'))
  const cli = join(dirname(require.resolve('knip')), '../bin/knip.js')
  const result = spawnSync(
    process.execPath,
    [
      cli,
      '--max-issues',
      String(maximum),
      ...(production ? ['--production'] : []),
    ],
    { stdio: 'inherit' }
  )
  if (result.error) {
    console.error('Could not start Knip')
    return 1
  }
  return result.status ?? 1
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = runDeadCode(process.argv.includes('--production'))
}
