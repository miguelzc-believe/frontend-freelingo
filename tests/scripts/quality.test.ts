import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('quality ignores a token file and fails before checks when SONAR_TOKEN is missing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-quality-'))
  const tokenFile = join(directory, 'token')
  writeFileSync(tokenFile, 'test-only-file-token\n', { mode: 0o600 })
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/quality.ts'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SONAR_TOKEN: '',
          SONAR_TOKEN_FILE: tokenFile,
          SONAR_HOST_URL: 'https://sonar.example.test',
          SONAR_PROJECT_KEY: 'example-project',
        },
        encoding: 'utf8',
      }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Missing SonarQube environment variables: SONAR_TOKEN.'
    )
    expect(result.stdout).toBe('')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
