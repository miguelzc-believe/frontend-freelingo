import { spawnSync } from 'node:child_process'
import budgets from '../quality-budgets.json'

const production = process.argv.includes('--production')
const maximum = production ? budgets.deadCode.production : budgets.deadCode.full
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'knip',
    '--max-issues',
    String(maximum),
    ...(production ? ['--production'] : []),
  ],
  { stdio: 'inherit' }
)
if (result.error) {
  console.error('Could not start Knip')
  process.exit(1)
}
process.exitCode = result.status ?? 1
