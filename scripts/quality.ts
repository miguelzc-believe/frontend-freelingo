import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const tokenFile =
  process.env.SONAR_TOKEN_FILE ||
  join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'freelingo',
    'sonar-token'
  )

let token = process.env.SONAR_TOKEN?.trim()
if (!token) {
  try {
    token = readFileSync(tokenFile, 'utf8').trim()
  } catch {
    // Report how to supply credentials without logging their contents.
  }
}

if (!token) {
  console.error(
    'Missing SonarQube token. Set SONAR_TOKEN or store it in SONAR_TOKEN_FILE ' +
      `(default: ${tokenFile}).`
  )
  process.exit(1)
}

// Credentials are passed only to the scanner, never as command-line arguments.
const checkEnv = { ...process.env }
delete checkEnv.SONAR_TOKEN
for (const args of [
  ['lint'],
  ['typecheck'],
  ['test:coverage'],
  ['exec', 'sonar-scanner-npm'],
]) {
  const isScanner = args[0] === 'exec'
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: isScanner ? { ...checkEnv, SONAR_TOKEN: token } : checkEnv,
  })
  if (result.error) {
    console.error(`Could not start pnpm ${args.join(' ')}.`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
