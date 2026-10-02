# SonarQube reliability semantics

Close three of the 44 open reliability findings on the `frontend-freelingo`
project, each isolated to one component, without touching the wider
interactive-semantics backlog (S1082, S6847, S6848).

Expected SonarQube delta after merge: 44 → 40 open reliability issues; the
three targeted rules plus the co-located `typescript:S1082` in the audio
player.

## Diagnosis

| Rule  | Location                                      | Nature                                                                                                                                                                                                |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S6852 | `src/components/ui/exercise-audio-player.tsx` | Real defect: a click-to-seek control is exposed as `role="progressbar"`, a role that is not focusable.                                                                                                |
| S6853 | `src/app/(app)/admin/system/page.tsx`         | Partly a false positive: the text exists (`admin.dashboardBanner.activeLabel` in all 15 locales) but sits two levels deep inside the label. Implicit association replaced by explicit `htmlFor`/`id`. |
| S1077 | `src/components/ui/app-image.tsx`             | False positive: `Props` requires `alt` and every call site passes it; static analysis cannot follow the requirement through `{...props}`.                                                             |

## Tasks

### T1 · S6852 — focusable seek slider

- [x] Done in `6f71303` — RED 7 failed / 5 passed, GREEN 12/12, typecheck and lint clean, `seekLabel` present exactly once in all 15 locales.

Expose the seek bar as `role="slider"`, add `tabIndex={0}`, and handle
`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` (±5s), `Home` (0) and `End`
(duration) with `preventDefault` only on those keys. Share one seek helper
between pointer and keyboard. Guard on `duration === 0` exactly like the
existing pointer path. Add `aria-label` from a new `listening.seekLabel`
message in all 15 locales; keep `aria-valuemin`, `aria-valuemax` and
`aria-valuenow`, and do not add `aria-valuetext` because the 0-100 range is
already announced correctly.

### T2 · S6853 — explicit checkbox label association

- [x] Done in `dff95fa` — RED 1 failed / 4 passed, GREEN 5/5, typecheck, lint and Prettier clean, and the other 8 labels in the page are untouched.

Give the announcement active checkbox an `id`, link its label with
`htmlFor`, and move the visible label text to a direct child of the label.
Route the hint to `aria-describedby` so the accessible name stops
concatenating label and hint. Preserve the existing box model so the
rendered layout does not change.

### T3 · S1077 — explicit alt passthrough

- [x] Done in `fd3168b` — no RED is possible for a static-analysis fix; six equivalence cases pass before and after the change.

### Note for future work

`tests/setup.ts` mocks `@/components/ui/app-image` globally, so any test
that needs the real component must call
`vi.unmock('@/components/ui/app-image')`.

Destructure `alt` out of the rest spread in `AppImage` and pass it
explicitly to the `<img>`. No behaviour change; the required prop becomes
visible to static analysis.

### T4 · Evidence

- [x] Done.

Changelog entry added to the Unreleased section.

Local gate on the final tree: lint, typecheck, dead-code (18/19 full,
19/19 production) and CRAP pass. The full coverage suite passes with 109 test
files and 1097 tests at statements 85.77%, branches 80.83%, functions 80.25%
and lines 87.43%.

SonarQube confirms the reliability delta on the analysis of this branch
(revision `fd3168b`): **44 → 40 open reliability issues**, LOW 21 → 19 and
MEDIUM 22 → 20, with the HIGH unchanged.

| Rule                              | Before        | After     |
| --------------------------------- | ------------- | --------- |
| S6852                             | 1             | 0         |
| S6853                             | 1             | 0         |
| S1077                             | 1             | 0         |
| S1082                             | 17            | 16        |
| S6847 / S6848                     | 2 / 14        | 2 / 14    |
| S3923, S2871, S7773, S7758, S8786 | 3, 1, 2, 1, 1 | unchanged |

The co-located `typescript:S1082` in `exercise-audio-player.tsx` closed with
the slider fix, which is why the total moves by four rather than three. No
`S6848` was involved in that file.

The scanner stores its analysis on the main branch because
`sonar-project.properties` sets no `sonar.branch.name`, so the branch-scoped
query is not the measurement surface; the main-branch analysis of revision
`fd3168b` is.

The quality gate remains `ERROR` on new-code maintainability violations,
which is pre-existing and unrelated to this work.

### Known intermittent, not caused by this work

`tests/app/lesson-word-tooltip.test.tsx` → "keeps the word tooltip open when
the exercises array is replaced without navigation" failed once inside a full
coverage run and then passed on a clean re-run of the same command. It does
not reproduce in isolation, beside `tests/app/lesson-flow.test.tsx`, or under
a seeded shuffle. `src/app/(app)/lesson/[id]/page.tsx` imports none of the
components touched here. The same symptom is already recorded twice in
`odd/tasks/coverage-80.md`. It stays an open item for the lesson page work.

## Verification

- `pnpm vitest run tests/components/ExerciseAudioPlayer.test.tsx tests/app/admin-system-banner.test.tsx tests/components/app-image.test.tsx`
- `pnpm lint`, `pnpm typecheck`
- No new module-level exports: production dead-code budget is already at
  19/19.

## Out of scope

- The remaining 33 interactive-semantics findings (S1082, S6847, S6848).
- Replacing the custom seek bar with `<input type="range">`, which would
  break the `fl-*` visual tokens.
- Adding `eslint-plugin-sonarjs` for local reproduction.

### Native review

Lineage `review-04324907af4b9a48` covers the committed slice
`41e2ead..0d0ac87` (23 files, 398 changed lines, medium tier, single
`review-reliability` lens, correction budget 199).

The reviewer slot could not be materialized. Two host-relay attempts both
failed with `pi-host-relay-transport-failure`, `reviewer-empty-output`,
`stopReason: length` after roughly 50 seconds each. No reviewer artifact was
admitted, no verdict exists, and no approval was burned. The lineage stays in
`reviewing` with the slot outstanding, so this candidate carries no native
review outcome in either direction.
