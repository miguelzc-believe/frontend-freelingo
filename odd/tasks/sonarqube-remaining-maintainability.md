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

Pending: S8980 6, S2925 3, S1607 1, S5976 1. Preserve asynchronous completion
barriers, timer boundaries and native audio assertions; no count-only weakening.

## Step 3 — Readability and cognitive complexity (73 findings)

Pending: S3358 50 and S3776 23 in 23 files. Internal file-disjoint batches may
run concurrently, but all belong in one step-3 commit. Preserve hooks/state
lifetimes, lazy translation, stable authored/entity identity, same-origin auth,
per-language state, audio cancellation and SSE terminal semantics. Extracted
functions must not simply inherit the original excessive complexity.

Final acceptance requires fresh local coverage/quality checks, relevant browser
regressions, and Sonar analysis/query. Unverified server closure is never zero.
