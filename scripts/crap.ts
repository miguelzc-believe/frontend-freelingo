import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { analyse } from '@danibram/crap4ts'
import budgets from '../quality-budgets.json'

// Require real coverage; functions without measurements remain pessimistic.
readFileSync('coverage/coverage-final.json', 'utf8')
const result = await analyse({
  paths: ['src'],
  ignore: ['**/routeTree.gen.ts'],
  coverageFile: 'coverage/coverage-final.json',
  coverageFormat: 'v8',
  tsconfigPath: 'tsconfig.json',
  missing: 'pessimistic',
  complexityMetric: 'cyclomatic',
})
const functions = result.functions.map((risk) => ({
  ...risk,
  file: relative(process.cwd(), risk.file),
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
mkdirSync('reports/quality', { recursive: true })
writeFileSync(
  'reports/quality/crap.json',
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
  !process.argv.includes('--report-only') &&
  (highRisk.length > budgets.crap.maxHighRiskFunctions ||
    report.maxCrap > budgets.crap.maxScore)
) {
  console.error(
    'CRAP exceeds the reviewed legacy budget. See reports/quality/crap.json.'
  )
  process.exitCode = 1
}
