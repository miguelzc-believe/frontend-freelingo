import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('quality fails before running checks or uploading when credentials are missing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-quality-'))
  const tokenFile = join(directory, 'token')
  writeFileSync(tokenFile, '\n', { mode: 0o600 })
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/quality.ts'],
      {
        cwd: process.cwd(),
        env: { ...process.env, SONAR_TOKEN: '', SONAR_TOKEN_FILE: tokenFile },
        encoding: 'utf8',
      }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing SonarQube token')
    expect(result.stdout).toBe('')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
