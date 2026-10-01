# SonarQube coverage to 80%

## Objective
Raise trustworthy global SonarQube coverage for the frontend to at least 80%, using behavioral tests and aligned Vitest/Sonar scope without artificial exclusions or empty tests.

## Constraints
- Use pnpm exclusively.
- Start from local `development` on a task branch; merge locally only after checks.
- Preserve existing `.gitignore` modification.
- Keep Sonar credentials in environment variables; do not commit secrets.
- Keep Stryker manual-only.
- Technical artifacts use English, strict TypeScript conventions, and existing project tokens.

## Scope
- Fresh baseline and coverage-scope reconciliation.
- Critical audio/lib/VAD logic.
- Auth, app layout, providers, and error boundaries.
- Assessment, conversation, Reading, and Listening flows.
- Remaining UI, routes, and server edge cases selected by measured impact.
- Threshold/documentation updates only after observed final results.

## Tasks
- [x] T1: Generate fresh baseline and rank coverage gaps.
- [x] T2: Cover critical audio, library, and VAD behavior.
- [x] T3: Cover auth, layout, providers, and error boundaries.
- [x] T4: Cover core learning flows (assessment and conversation slice).
- [ ] T4b: Cover Reading and Listening flows (deferred from T4 by slice budget).
- [ ] T5: Cover remaining UI, routes, and server behavior.
- [ ] T6: Verify quality gates, update thresholds/docs, and record final Sonar result.

## Acceptance criteria
- Fresh `pnpm test:coverage` report is reproducible.
- Sonar and Vitest measured scope is understood and no valid production code is excluded solely to improve the metric.
- Relevant tests cover success, failure, and meaningful branch behavior.
- Local quality checks pass.
- Real SonarQube analysis reaches global coverage >=80%, or remaining blocker and exact gap are documented.

## Verification
- `pnpm test:coverage`
- `pnpm quality:local`
- `pnpm quality` when Sonar environment is available
- Inspect `coverage/coverage-summary.json`, `coverage/lcov.info`, `reports/quality/`, and Sonar output.

## Progress
- T1 done: fresh `pnpm test:coverage` confirms statements 48.73%, branches 45.27%, functions 44.06%, lines 49.53%; 74 files / 709 tests pass. The previously stored report was accurate.
- T2 done on `feature/coverage-80-audio` (commit `821a9c5`): 9 new tests for `createAudioQueue`. `src/lib/audio.ts` lines 20.83% -> 94.44%, branches 8% -> 72%. Project lines 51.24%, branches 45.87%, functions 44.82%, statements 50.35%. `conversation-vad.ts` was already 100% lines/branches/functions. No production change was needed.
- T2 checks observed: `pnpm exec vitest run tests/lib/audio.test.ts` 17 passed; `pnpm test:coverage -- --silent` 74 files / 718 tests passed; `pnpm typecheck` clean; eslint and prettier clean. Parent spot check re-ran the focused suite: 17 passed.
- T3 done on `feature/coverage-80-audio` (commit `d0f5676`): 12 new tests in `tests/app/app-layout.test.tsx` and `tests/app/error-not-found.test.tsx`. `src/app/(app)/layout.tsx` 0% -> 70.27% lines, 42.56% branches, 47.22% functions. `src/app/error.tsx` and `src/app/not-found.tsx` reach 100%. Project lines 52.61%, branches 47.19%, functions 45.99%, statements 51.73%. No production change.
- T3 checks observed: focused suites 12 passed; full `pnpm test:coverage -- --silent` green; `pnpm typecheck` clean; `eslint . --max-warnings 0` clean. Parent spot check re-ran both focused suites: 12 passed.
- T3 residual gap: layout branches stay at 42.56% because desktop sidebar and mobile dropdown duplicate JSX; covering both variants needs near-duplicate assertions of limited behavioral value.
- Pre-existing prettier warnings remain on `odd/tasks/coverage-80.md` and `pnpm-lock.yaml`; unrelated to this feature and outside the writer surfaces.
- T4 done on `feature/coverage-80-audio` (commit `241f316`): 24 new tests in 4 files. `src/app/(app)/assessment/page.tsx` 0% -> 82.47% lines, `src/app/(app)/assessment/level-test/page.tsx` 0% -> 95.76%, `src/app/(app)/conversation/page.tsx` 0% -> 94.11%. `BeginnerGate.tsx` and `SessionTimeoutBanner.tsx` reach 100%, `DurationSelector.tsx` 83.33%. Project lines 58.35%, branches 51.84%, functions 50.55%, statements 57.38%. No production change.
- T4 checks observed: 4 focused suites 24 passed; full `pnpm test:coverage -- --silent` 80 files / 754 tests passed; `pnpm typecheck` clean; eslint and prettier clean. Parent spot check re-ran the 4 focused suites: 24 passed.
- T4 partial: assessment and conversation slices done (commit `241f316`); Reading and Listening deferred to T4b by slice budget (~683 lines already authored).
- T4 production finding, not fixed: `assessment/page.tsx` sets `error` on the duration step when plan creation fails, but the error renders only on the existing and result steps; a failed plan creation is invisible to the user. Flagged for a follow-up decision, not part of this feature's scope.
- Known pitfall documented by the worker: a `use-intl` mock that returns a new function per render causes an infinite reload effect in pages whose hooks depend on `t`; use a stable function reference.
- Planning baseline came from the existing stale report: documented Sonar overall 48.6%, new code 95.2%.
- Sonar sources are `src,scripts`; Vitest includes only selected quality scripts in addition to `src`.
- Branch policy: work proceeds on `feature/coverage-80-audio` for the T2 slice, created from local `development`. Later slices branch from the last merged slice or from `development` as appropriate.
- Route: T2 delegated to `gentle-ai-worker` (multi-file write rule). First delegation was relaunched after task identity and branch state were reconciled.
- Strict test-first is disabled for T2: the slice adds tests for existing behavior, so there is no meaningful RED phase; focused test runs plus the coverage run are the applicable checks.
- Pre-existing `.gitignore` modification is preserved and untouched. Untracked `.codegraph/` index directory exists and is not part of any candidate.

## Next step
Await T2 worker result, spot-check the diff and coverage numbers, then close the work unit with a commit and continue to T3.
