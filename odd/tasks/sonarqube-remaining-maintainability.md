# Remaining SonarQube maintainability remediation

## Scope and delivery

User authorized the 87 unresolved maintainability findings in three ordered
implementation commits, including related tests and documentation. No push,
publication or deployment is authorized. Task branch
`fix/sonar-remaining-maintainability` was created from local `development`, then
fast-forwarded to the preserved prior category work at `52e13dc`. Local
integration will occur only after applicable checks.

Authenticated read-only baseline: project `frontend-freelingo`, analysis task
`0f3dd2fe-9735-4f3e-996f-2dbaed62be50`, completed 2026-10-05 03:40:58 UTC.
87 unique unresolved MAINTAINABILITY findings in 27 files: HIGH 23, MEDIUM 64.
Rule counts: S3358 50, S3776 23, S8980 6, S2925 3, S6479 2, S6847 1,
S1607 1, S5976 1. S6847 also affects reliability; it is counted once here.
Quality gate ERROR is new_violations=10 versus threshold 0, not all 87 findings.
New coverage 88.7 and duplication density 0.34199 pass the server conditions.

## Step 1 — Scoped identity and native dialog interactions (3 findings)

- FAQ workflow keys use authored translation identifiers; questions carry
  explicit authored IDs. Translated text, order, numbering, accordion state and
  fl-* styles are preserved. New tests characterize DOM continuity across a
  translation change (equivalence evidence, not an invented failing regression).
- Native create-user dialog delegates light dismissal to `closedby="any"`
  instead of an onClick listener on a non-interactive element. An independent
  review found Safari/older-engine compatibility requires a feature-detected
  native listener fallback, with bounds checking and effect cleanup; incorporated
  into the same step-1 commit. Native cancel
  closes the dialog before React unmounts it, allowing native focus restoration.
  Browser coverage observed a focus-return failure first, then passed after this
  fix. jsdom tests exercise cancel/close events and assert the light-dismiss
  attribute; they do not simulate the native browser algorithm.
- Baseline: `pnpm vitest run tests/app/admin-users.test.tsx` — 37/37 passed.
- Final: `pnpm vitest run tests/app/admin-users.test.tsx tests/app/faq-page.test.tsx`
  — 2 files / 40 tests passed after the compatibility correction.
- `pnpm typecheck`, `pnpm lint`, scoped Prettier and `git diff --check` passed.
- `pnpm exec playwright test tests/e2e/maintainability-interactions.spec.ts`
  — final 6/6 passed, desktop and mobile-emulated Chromium, including a
  synthetic unsupported-engine fallback (not real Safari acceptance). Real native modal,
  field interaction, inert-background tab behavior, Escape, outside dismissal,
  focus return and FAQ workflow order verified against fixture-backed production
  build. Chromium may put focus in browser chrome at the tab boundary (BODY
  activeElement), never on an inert page control. No Firefox, physical device,
  live backend, screen-reader or pixel-perfect acceptance claim.
- Mechanical UI detector returned no findings. Build emitted existing Vite,
  dynamic-import and module-directive warnings, without a failed build.
- Rollback boundary: FAQ IDs/keys and dialog dismissal lifecycle plus their
  directly related unit/browser tests; unrelated earlier categories unchanged.
- Sonar closure awaits a final scan and read-only issue query.

## Step 2 — Test quality (11 findings)

Implementation complete and independently verified before the step-2 commit.
Targets: S8980 6, S2925 3, S1607 1, S5976 1.

- AudioPlayer removes only the six event-call act wrappers. Successful playback
  waits for a new Audio object with onended/onerror installed. Failure tests use
  named deferred requests and meaningful async settlement acts; loading and
  unchanged Date.now prove no fake timer advancement during settlement. Native
  callback and timer acts remain intact.
- ProfileSection parameterizes the three rendering cases with their existing
  names/assertions/setup, preserving test count.
- Voice-recorder E2E now runs both Chromium profiles instead of skipping mobile
  emulation. Native-node observation counts non-silent PCM without saving it or
  replacing production onmessage. Fixed waits become positive capture/release,
  stopped-ACK and next-card/idle barriers. Existing WAV format, plan snapshot,
  real automatic-duration, exactly-once delivery and cancellation assertions
  remain. Native original methods are forwarded; disconnect overload preserved
  through a Proxy apply trap.
- Worker baseline/post: `pnpm vitest run tests/components/AudioPlayer.test.tsx
tests/components/ProfileSection.test.tsx` — 2 files / 87 tests passed both.
- Worker `pnpm exec playwright test tests/e2e/voice-recorder.spec.ts` — final
  8/8 passed, no skips. Initial new cancellation selector had incorrect case;
  corrected against observed UI, no production bug inferred.
- Parent independently inspected all three diffs; final typecheck/lint passed.
  Worker scoped formatting and whitespace checks passed. Independent verifier
  ses_ef59f03ccffeIvVAlCHMHmLU1k passed 2 files / 87 tests, scoped formatting
  and whitespace checks, and inspected every change with no blocker. Browser
  8/8 is worker-executed evidence, not an independent replay.
- Browser acceptance is fixture-backed desktop/mobile-emulated Chromium with
  generated microphone and native AudioWorklet, not physical-device, live STT,
  Safari/Firefox or deployment. Existing build warnings and nonfatal aborted
  request ECONNRESET messages do not constitute failed assertions.
- Rollback boundary: the three test-only files; no production behavior changes.
- Sonar closure of the eleven issues remains pending a scan.

## Step 3 — Readability and cognitive complexity (73 findings)

Implemented as file-disjoint batches consolidated into one commit. Sonar-mirror
checker `/tmp/opencode/sonar-maintainability-check/check.mjs` — total 0
(73 → 0 in owned files). Individual page checks also total 0, matching
the 73 Sonar baseline exactly. Checker rules mirror the Sonar definitions;
server closure remains scan-dependent.

### Dashboard slice (13 findings)

- `src/app/(app)/dashboard/page.tsx`: verified total 0.
- Extracted `getPlanProgress`, `emptyTodayKey`, `premiumTitle/Description/Cta`,
  `DashboardNextStep`, `DashboardStats`, `DashboardPlanProgress`,
  `DashboardTodayLessons`, `DashboardPerformance`, `DashboardPremiumBanner`,
  `DashboardNextAction`, `TodayLessonAction`.
- Tests: `tests/app/dashboard-next-step.test.tsx` 10 → 14, including premium
  banner precedence (eligible trial, used trial, payment recovery, active
  freemium trial) and the existing lesson-slot plus plan-progress assertions.
  `pnpm vitest run tests/app/dashboard-next-step.test.tsx` — 14/14 passed.
  Scoped page check total 0; `pnpm typecheck` and `pnpm lint` passed;
  scoped formatting and `git diff --check` passed.

### Lesson / free-write slice (16 findings)

- `src/app/(app)/lesson/[id]/page.tsx`, `src/lib/free-write-corrections.ts`,
  `tests/app/lesson-flow.test.tsx`.
- Lesson extracted stateless module-scope sections plus readonly prop boundaries.
  Hooks, states, effects and handlers remain in `LessonPage`; no render-defined
  components.
- `src/lib/free-write-corrections.ts` now separates candidate generation,
  allocation passes and segment reconstruction without changing priorities,
  wholeness ordering, placement tracking or ranges.
- LessonPage complexity 101 → 9; individual helper maxima lesson 13,
  corrections 14 (≤ 15). All 14 nested conditionals eliminated.
- Tests: baseline 63/63, final 66/66 for the four requested files; lesson-flow
  36/36 standalone.
- Rollback boundary for both slices is their owned files plus their directly
  related tests; unrelated Sonar categories unchanged.

### Chat / SSE slice (8 findings)

- `src/app/(app)/chat/page.tsx`, `src/lib/sse.ts`.
- Chat extracts stateless presentation helpers plus `getChatErrorMessage`,
  `consumeChatResponse`, `retryConversations` and stream handlers. Single
  assistant record per send, reset before the first token, independent if-checks
  (never else-if), same terminal-marker and voice-handoff semantics.
  SSE separates `normalizeLineEndings` with trailing-CR retention and final-event
  validation, preserving decoder/buffer ownership and releaseLock.
- Tests: `tests/app/chat-memory-stream.test.tsx` `tests/lib/chat-messages.test.ts`
  `tests/lib/sse.test.ts` — 3 files / 28 passed.
- Scoped checks: formatting, lint and `pnpm typecheck` passed; page check total 0.

### Conversation, onboarding, commerce, admin, reading/listening

Tracked in pending maintenance sequencing; implementation spans
`src/app/(app)/admin/*`, `src/app/(app)/conversation/*`,
`src/components/billing/*`, `src/components/conversation/*`,
`src/components/reviews/*`, `src/components/settings/*`,
`src/components/ui/*` and the auth/onboarding/learning pages.
The pending local manifest maps sources and file-ownership slices but does
not commit batches separately.

### Pending validation for step 3

Full quality: `pnpm quality:local`, migrated-route browser regressions, and a
final authenticated Sonar scan/query. No Sonar closure or merge is claimed
until the independent query returns zero unresolved MAINTAINABILITY issues.
