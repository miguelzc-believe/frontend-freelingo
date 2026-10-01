import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyse } from '@danibram/crap4ts'
import budgets from '../quality-budgets.json'

export async function runCrap(root = process.cwd(), reportOnly = false) {
  // Require real coverage; functions without measurements remain pessimistic.
  const coverage = join(root, 'coverage/coverage-final.json')
  readFileSync(coverage, 'utf8')
  const result = await analyse({
    paths: [join(root, 'src')],
    ignore: ['**/routeTree.gen.ts'],
    coverageFile: coverage,
    coverageFormat: 'v8',
    tsconfigPath: join(root, 'tsconfig.json'),
    missing: 'pessimistic',
    complexityMetric: 'cyclomatic',
  })
  const functions = result.functions.map((risk) => ({
    ...risk,
    file: relative(root, risk.file),
  }))
  functions.sort((a, b) => b.crap - a.crap)
  const highRisk = functions.filter((risk) => risk.crap > 30)
  const report = {
    formula: 'C^2 * (1 - statement-coverage/100)^3 + C',
    functions: functions.length,
    highRiskFunctions: highRisk.length,
    maxCrap: functions[0]?.crap ?? 0,
    risks: functions,
  }
  mkdirSync(join(root, 'reports/quality'), { recursive: true })
  writeFileSync(
    join(root, 'reports/quality/crap.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  console.log(
    `CRAP: ${functions.length} functions, ${highRisk.length} above 30, maximum ${report.maxCrap.toFixed(2)}`
  )
  for (const risk of highRisk.slice(0, 10)) {
    console.log(
      `${risk.file}:${risk.startLine} ${risk.name}: C=${risk.complexity}, coverage=${risk.coverage.toFixed(1)}%, CRAP=${risk.crap.toFixed(2)}`
    )
  }
  if (
    !reportOnly &&
    (highRisk.length > budgets.crap.maxHighRiskFunctions ||
      report.maxCrap > budgets.crap.maxScore)
  ) {
    console.error(
      'CRAP exceeds the reviewed legacy budget. See reports/quality/crap.json.'
    )
    return 1
  }
  return 0
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runCrap(
    process.cwd(),
    process.argv.includes('--report-only')
  )
}
