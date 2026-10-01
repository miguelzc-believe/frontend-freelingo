# Run the quality checks

Use `pnpm quality:local` for lint, strict types, dead-code checks, fresh coverage
and CRAP. Mutation testing is manual: run `pnpm test:mutation:core` for the
critical session, API, assessment-answer and language-state code, or
`pnpm test:mutation` for the full application. `pnpm quality` does not run Stryker.

| Command                             | Scope and result                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm quality:dead-code`            | Knip across source, tooling and tests; fails above the legacy issue budget.                       |
| `pnpm quality:dead-code:production` | Knip on shipped source without test-only reachability.                                            |
| `pnpm quality:dead-code:report`     | Unbudgeted Knip report; returns nonzero while findings remain.                                    |
| `pnpm test:coverage`                | V8 coverage, LCOV and JSON; enforces global minimums.                                             |
| `pnpm quality:crap`                 | CRAP from fresh `coverage/coverage-final.json`; writes `reports/quality/crap.json`.               |
| `pnpm test:mutation:core`           | Four critical files; HTML/JSON under `reports/mutation/core.*`.                                   |
| `pnpm test:mutation`                | All application TS/TSX, excluding generated routes; separate full reports.                        |
| `pnpm test:mutation:incremental`    | Full scope with reusable local results; force a fresh run after dependency/configuration changes. |

## Limits and existing debt

Coverage minimums are statements 48%, branches 44%, functions 43% and lines 49%.
These floors preserve the measured starting point; raise them as coverage improves.
Application files without tests remain included. Generated `src/routeTree.gen.ts`
is the only source exclusion from coverage, CRAP and mutation analysis.

`quality-budgets.json` records 19 Knip issues in each mode and CRAP caps of 91
functions above 30 and a maximum score of 1185.77 (the measured maximum rounded
up to two decimals). These aggregate budgets fail
when counts or the maximum exceed the baseline; inspect individual findings
even when totals pass, and reduce budgets after removing debt. Budget changes
belong in reviewed commits with new measurement evidence. Existing unused UI
components and high-risk screens stay visible in reports.

Knip uses its TanStack Router, Vite, Tailwind, Vitest, Playwright and Stryker
plugins. CSS is included so local font imports are reachable. The fixture server
is an explicit tooling entry. `ignoreExportsUsedInFile` permits internal-only
exports; the one dependency exception, `@sonar/scan`, is invoked through a
dynamic argument array in the quality runner. Generated routes remain in Knip's
graph so they connect every screen. [Knip's gradual-adoption guide](https://knip.dev/guides/adopt-gradually)
supports using issue budgets after resolving entry-point gaps.

CRAP uses `C² × (1 − coverage/100)³ + C`, cyclomatic complexity and a warning
threshold of 30, following [the original metric](https://testing.googleblog.com/2011/02/this-code-is-crap.html).
`crap4ts` extracts functions from the TypeScript AST and approximates coverage
with statement hits within each function's line range. Missing measurements are
zero coverage. This is a prioritization metric; its statement coverage is an
approximation of basis-path coverage. [Tool behavior and limitations](https://github.com/danibram/crap4ts#how-it-works)
are documented upstream.

Both mutation profiles enforce a global mutation score of 80%, with 90% as the
high band. Uncovered and surviving mutants count against the score. The Vitest
runner uses per-test coverage and its own single-worker pool; Stryker limits
concurrency to two workers. Fresh runs are the default. [Incremental mode](https://stryker-mutator.io/docs/stryker-js/incremental/)
does not detect every environment or dependency change. Sandboxes, coverage and
reports are ignored by Git and Docker; `.env*` and local runtime state are not
copied into mutation sandboxes. No Stryker dashboard publishing is configured.

## Compatibility

Context7 was consulted for Knip/TanStack entries, Stryker's Vitest 4 pool handling
and Vitest V8 reporting/thresholds; registry metadata and installed versions
were checked directly. New dependencies are pinned exactly.

| Tool                           | Version | Requirement verified                                                                     |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------- |
| Knip                           | 6.38.0  | Node `^20.19.0` or `>=22.12.0`; selected after its release-age window.                   |
| Stryker core and Vitest runner | 10.0.0  | Matching versions, Node `>=22`, Vitest `>=2`; explicit Vitest 4.1 pool support.          |
| crap4ts                        | 0.6.0   | Node `>=18`; TS/TSX AST parsing and V8 JSON tested with fixtures and application source. |
| Vitest and coverage-v8         | 4.1.11  | Matching versions; existing Vite 8.3.1 and TypeScript 5.9.3 retained.                    |

Local runtime validation uses Node 24.21.0 and pnpm 12.5.1.

## Automation and SonarQube

`pnpm quality` runs the local checks and the
authenticated SonarQube scan, waiting for the existing server Quality Gate.
SonarQube supplies duplication, security and maintainability analysis. See the
[README](../README.md#sonarqube-quality-analysis) for environment configuration.
The runner resolves an absolute pnpm launcher before executing checks and passes
the analysis token only to the scanner. Regression tests cover failure at each
stage, required environment variables, token isolation and JavaScript/standalone
launchers. Connection settings come exclusively from `SONAR_TOKEN`,
`SONAR_HOST_URL` and `SONAR_PROJECT_KEY`. No token-file fallback is supported.

GitHub Actions runs coverage, CRAP, both Knip modes and E2E on pushes and PRs.
Both mutation profiles require an explicit manual workflow dispatch: select
`core_mutation` or `full_mutation`; both options default to false. Mutation jobs
are independent of SonarQube, which runs after the checks job.
Reports are retained for seven days. SonarQube runs
on `development`, when the repository secret `SONAR_TOKEN` and variables
`SONAR_HOST_URL`/`SONAR_PROJECT_KEY` exist; otherwise
the scan step explicitly reports a skip. Community Build uses one analysis
branch. CI uses Node 24.21.0, matching local validation and the project's engine
requirement; the previous Node 25 is [end of life](https://nodejs.org/en/about/previous-releases).
The workflow configuration was parsed locally; live GitHub Actions execution
and secret configuration were not validated because this checkout has no remote.

## Measured checks

Validated on 2026-09-30: five focused script test files passed 17 tests;
the complete coverage suite passed 74 files / 708 tests with 49.52% line coverage.
The CRAP and Knip utilities are included in LCOV, with 94.73% and 90.90% line
coverage respectively; the quality runner has 97.05%. Knip executes its
installed CLI using absolute paths.
CRAP measured 1703 functions, 91 above 30 and a maximum of 1185.7607041840743.
Negative controls proved that adding an unused file exceeds the Knip budget,
insufficient coverage fails Vitest, and risky untested code fails the CRAP CLI.
The full Stryker dry run instrumented 202 files / 17507 mutants and passed 672
related tests. It validates instrumentation and runner compatibility; it does
not measure the full mutation score.
Critical-code mutation testing measured 81.94% across 155 mutants: 127 detected,
25 surviving and three uncovered. E2E completed 11 tests with one intentional
mobile route-sweep skip, using a production build and the fixture backend.
`pnpm quality` completed end to end. The existing Sonar way gate returned `OK`:
new-code coverage 95.5% (minimum 80%), new duplication 0% (maximum 3%) and zero
new issues. Overall SonarQube combined coverage is 48.6% and duplication 5.5%;
existing application debt remains visible. SonarQube's combined coverage and
Vitest's line coverage are different metrics.

The environment-only change was checked with `pnpm exec vitest run tests/scripts`
(five files / 19 tests), `pnpm lint` and `pnpm typecheck`. The real CLI exits with
code 1 before checks when `SONAR_TOKEN` is absent, even with a populated legacy
token file. The runner's tests verify host/project overrides and token isolation.
No new remote analysis was required for this credential-source change.

Manual-only mutation execution was checked with `pnpm exec vitest run tests/scripts`
(five files / 18 tests). The runner regression verifies exactly local checks and
the scanner, with no mutation command. Workflow validation confirms both mutation
flags default to false, require `workflow_dispatch` and are not Sonar dependencies.

## Removal

To remove these controls, remove the Knip/Stryker configs, quality budgets,
`scripts/crap.ts`, `scripts/dead-code.ts`, their tests, added dependencies and
package commands; restore Vitest's previous coverage settings and remove the
report/sandbox ignore entries. Application behavior and backend contracts are
unaffected.
To roll back only the environment requirement, restore the runner and its tests,
connection properties, Sonar CI environment and corresponding README/guide
instructions together. The local budgets and mutation profiles are independent.
To roll back only manual mutation scheduling, restore the runner sequence, its
regression test and workflow job conditions/dependencies with their README/guide
instructions. Stryker's mutation scopes and score thresholds are independent.
