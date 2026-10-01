import { analyse, crap } from '@danibram/crap4ts'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('CRAP parses TypeScript and measures partial statement coverage', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-crap-'))
  const source = join(directory, 'choose.ts')
  const coverage = join(directory, 'coverage.json')
  writeFileSync(
    source,
    [
      'export function choose(flag: boolean) {',
      '  if (flag) {',
      '    return 1',
      '  }',
      '  return 0',
      '}',
    ].join('\n')
  )
  writeFileSync(
    coverage,
    JSON.stringify({
      [source]: {
        path: source,
        statementMap: {
          '0': { start: { line: 2, column: 2 }, end: { line: 4, column: 3 } },
          '1': { start: { line: 3, column: 4 }, end: { line: 3, column: 12 } },
          '2': { start: { line: 5, column: 2 }, end: { line: 5, column: 10 } },
        },
        s: { '0': 1, '1': 0, '2': 1 },
        fnMap: {},
        f: {},
      },
    })
  )
  try {
    const result = await analyse({
      paths: [source],
      coverageFile: coverage,
      missing: 'pessimistic',
    })
    const risk = result.functions[0]
    expect(risk?.complexity).toBe(2)
    expect(risk?.coverage).toBeCloseTo(200 / 3)
    expect(risk?.crap).toBeCloseTo(4 * (1 / 3) ** 3 + 2)
    expect(crap(10, 0)).toBe(110)
    expect(crap(10, 100)).toBe(10)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('nested TSX functions get separate complexity and missing coverage is zero', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'freelingo-crap-nested-'))
  const source = join(directory, 'nested.tsx')
  writeFileSync(
    source,
    [
      'export function outer(flag: boolean) {',
      '  function inner() {',
      '    if (flag) return <span>yes</span>',
      '    return <span>no</span>',
      '  }',
      '  return inner()',
      '}',
    ].join('\n')
  )
  try {
    const result = await analyse({ paths: [source], missing: 'pessimistic' })
    expect(result.functions).toHaveLength(2)
    expect(result.functions.find((fn) => fn.name === 'outer')).toMatchObject({
      complexity: 1,
      coverage: 0,
      crap: 2,
      coverageMissing: true,
    })
    expect(result.functions.find((fn) => fn.name === 'inner')).toMatchObject({
      complexity: 2,
      coverage: 0,
      crap: 6,
      coverageMissing: true,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
