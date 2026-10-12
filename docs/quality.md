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
the analysis token only to the scanner and the read-only duplication guard. Regression tests cover failure at each
stage, required environment variables, token isolation and JavaScript/standalone
launchers. Connection settings come exclusively from `SONAR_TOKEN`,
`SONAR_HOST_URL` and `SONAR_PROJECT_KEY`. No token-file fallback is supported.

GitHub Actions runs coverage, CRAP, both Knip modes and E2E on pushes and PRs.
Both mutation profiles require an explicit manual workflow dispatch: select
`core_mutation` or `full_mutation`; both options default to false. Mutation jobs
are independent of SonarQube, which runs after the checks job.
Reports are retained for seven days. SonarQube runs
on `development`, when the repository secret `SONAR_TOKEN` and variables
`SONAR_HOST_URL`/`SONAR_PROJECT_KEY` exist; missing configuration now fails
the scan step rather than skipping the global duplication budget. Community Build uses one analysis
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
The complete `direnv exec . pnpm quality` run passed 74 files / 709 tests,
lint, types, Knip and CRAP, with 49.53% Vitest line coverage and no Stryker
invocation. SonarQube returned `OK`: new-code coverage 95.2%, new duplication
0% and zero new issues. Existing findings total 21 bugs, three security warnings
and 404 code smells; overall combined coverage is 48.6%, duplication 5.5%.

## Global duplication budget

`pnpm quality:duplication` is a read-only post-scan check. It requires the same
three Sonar environment variables as `pnpm quality` and rejects global
`duplicated_lines_density >= 1%`, missing/malformed measures and unsuccessful
compute tasks. A green new-code Quality Gate alone does not meet this budget.
The metric is `duplicated_lines / lines * 100`, not duplicated lines divided by
NCLOC. No CPD exclusions or token/line thresholds have been added.

`pnpm quality` prepares a fresh `.scannerwork/report-task.txt`, passes the full
Git HEAD as `sonar.scm.revision`, waits for the existing server gate and runs the
post-scan check. The checker verifies the report's server/project, compute task,
explicit scanner revision and unchanged local HEAD. All tracked changes and
untracked authored files under `src`, `scripts`, `tests`, `messages`, `.github`
and the enumerated root configuration paths must be committed first. Unrelated
untracked local tooling data such as `.codegraph/` is preserved and does not
block the check; ignored files and untracked paths outside that authored scope
are not revision-bound. Playwright MCP artifacts are ignored, never committed.
The host URL is validated before scanner startup and cannot contain credentials,
query parameters or fragments. Scanner verbosity is pinned to false and log
level to INFO in arguments and environment, so inherited DEBUG/TRACE settings
cannot dump the scanner properties containing the analysis token. Startup
errors identify only the phase, never host values or command arguments.

The analysis token can read compute-task context and global/file measures, but
cannot read the project's analysis history or duplication groups. The measures
endpoint exposes only the latest state, not a snapshot selected by analysis ID.
Serialize all scans for this project, including local/external runners: CI has
its own concurrency group, which does not lock those other runners. The guard
honestly validates latest measures after the expected task, not an atomic
historical snapshot. Missing CI Sonar configuration now fails instead of
silently skipping the required duplication check.

Presentation is shared by domain: `components/practice`, `components/native-help`,
`components/auth`, `components/legal` and the administrative subscription badge.
Page-owned requests, validation, quota/replay rules and disclosure state stay
separate. `NATIVE_LANGUAGE_CODES` is independent of UI locales and the target
catalog; target display data has a typed tuple schema with one metadata mapper.
Existing `fl-*` classes, CJK text and authored occurrence identities are retained.
`NativeLanguageField` shares the native selector markup without coupling it to
UI locale choices. `usePracticeGeneration` shares only the 15-second warning
and unmount abort lifecycle; generation requests and error differences remain
screen-owned. The full browser suite also exposed a pre-existing admin dialog
bug: `closedby=any` was set only on unsupported engines. It is now set before
`showModal()` on all engines, retaining the older-engine outside-click fallback.

`tests/e2e/duplication-regressions.spec.ts` exercises the changed flows using a
production build and deterministic same-origin fixtures on desktop and mobile.
It complements the full browser suite and interactive Playwright MCP validation;
these checks do not establish live FastAPI/provider or physical-device acceptance.

### Measurement record

The fresh starting analysis on 2026-10-11 used revision
`d1d3d161def5108986fa92da31a8aefc3a00795e`: 1,409 duplicated lines out of 33,798
lines, 44 blocks and displayed density 4.2%. Compute task
`8d252716-ff55-4b6d-9108-af850e74169b` completed successfully. Its separate
server gate failed on 47 new issues; coverage and new-code duplication passed.
The intermediate working-tree scan reduced duplication to 324 / 33,890 lines,
10 blocks and displayed density 1.0% (task
`6b6b4509-f9b4-43ab-805c-96622a9428ff`). This was not accepted as the final
result: the shared native selector and generation lifecycle were extracted
next, and a clean revision-bound analysis is required below.

The production-build browser suite passed all 76 desktop/mobile cases, including
the ten new duplication regressions and the 38-route sweep on both projects.
The first run found two new-test label-selector mistakes and the existing
native dialog opt-in bug; both were corrected before the complete passing rerun.
Interactive Playwright MCP on the production server verified login/httpOnly
cookie restoration, reading/listening scoring and target-language attributes,
transcript timing, password independence, encoded legal invite navigation,
profile native choices, help disclosures and desktop/mobile dialog dismissal.
The asserted flows had no page errors or horizontal overflow. Screenshots were
captured, but visual screenshot comparison was not performed because the agent
runtime could not inspect image input. No physical-device or live-provider
acceptance is claimed.

Final local validation passed lint, strict types, both Knip budgets and all
1,548 tests in 138 files with fresh coverage: 90.76% lines, 84.27% branches,
88.83% statements and 86.32% functions. The guard/runner focused suite passed
130 tests. CPD source exclusions and existing quality budgets are unchanged.
The mechanical UI detector reported no findings on the changed screens and
shared components. Build succeeded with existing non-fatal Vite/Rolldown
warnings. CRAP passed: 1,925 functions, eight above 30 and maximum 56.00.
The clean analysis of `d2718314edee50a6711858d2f0caaf49fb93aa53` completed
successfully with no scanner warnings (task
`7afad1b3-7f25-4556-a07b-72379244d650`, analysis
`05993d08-64aa-4bd5-8208-0c939d6c86d0`). Sonar measured **0.6% global
duplication**, 214 duplicated lines / 33,917 lines and six blocks; the actual
`pnpm quality:duplication` command passed against the same clean HEAD. This is
1,195 fewer duplicated lines than the fresh starting analysis. Sonar combined
coverage was 88.2%. The independent server gate remained ERROR: new coverage
91.5% and new duplication 0.08843% passed, while the 62 new-code findings failed
its zero-issues condition. Read-only issue enumeration separated 47 pre-existing
findings from 15 findings introduced by the new tooling/component prop types.
The follow-up uses trusted absolute Git locations instead of PATH, exact
scanner-property parsing instead of backtracking regexes, smaller quality
phases and readonly component props. Its focused guard/runner suite passed
142 tests; independent review found no blockers. The post-remediation remote
analysis is recorded separately below rather than attributing the earlier
0.6% measurement to an unscanned revision.

### PR integration follow-up

All implementation work and the tooling follow-up are included in PR #4 to
`development`. The first final-quality run passed 1,559 / 1,560 tests but failed
the initial tooltip selection in `lesson-word-tooltip`; a nonconcurrent rerun
failed an initial draft-entry case in `lesson-flow`. Both unchanged test files
passed in isolation. Their synthetic interaction could race the initial
answer-restoration/selection-dismissal passive effects. The test harness now
awaits asynchronous `act` around those initial renders before entering input or
selecting text; existing assertions are retained with a stronger answer-value
check. Timeouts and production lesson code are unchanged.
The two focused files passed all 39 cases after the synchronization change.

GitHub Actions push/PR checks did not start: GitHub reported the account locked
due to a billing issue. No workflow steps ran, and no repository protections or
billing settings were changed. Local checks remain the available validation.
The post-remediation scan of `229113b668be89f59486009feda6ce9c694d094b`
(task `a688bafd-e0cb-479e-9d1f-f94b0eb42cd0`) measured 0.6% global duplication,
214 / 33,977 lines and six blocks; the revision-bound guard passed. The issue
query returned exactly 47 pre-existing findings, with none in the new tooling,
auth or legal components. That scan had no LCOV because the failed full test
runs had not generated it; it proves CPD/issue closure, not coverage acceptance.
The final `pnpm quality:local` run passed all 1,560 tests in 138 files, lint,
strict types, both Knip budgets and CRAP. Fresh coverage was 90.79% lines,
84.27% branches, 88.87% statements and 86.35% functions; CRAP remained eight
functions above 30 and maximum 56.00. Production E2E passed all 76 cases.

The clean scan of `6d888459ee190bb7a8274583665b399f6eda679a` imported that LCOV
and completed successfully (task `ce92829a-2a32-4418-99fa-a5b20eceb6dd`, analysis
`536b8a74-57c9-4925-bd31-dd065bb0877c`). Global duplication remained 0.6%,
214 / 33,977 lines and six blocks; the real revision-bound guard passed.
Sonar combined coverage was 88.3%; new coverage 91.5% and new duplication
0.08803% passed. The server gate still failed on 51 new-code issues: the 47
pre-existing findings plus four S8980 findings on the awaited initial test
renders. Sonar considers the act wrappers redundant because RTL wraps render
synchronously, but the observed harness races required awaiting the asynchronous
initial load/effects before synthetic interaction. The wrappers are retained
with this evidence, without rule suppressions, issue acceptance or a green-gate
claim. No new findings remain in the tooling/auth/legal components.

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
