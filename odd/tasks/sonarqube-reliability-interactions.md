# SonarQube reliability: interactive semantics and logic findings

Close the 40 open reliability findings on `frontend-freelingo`. SonarQube
reports them on 23 distinct source lines, so the work is 17 work-unit commits,
not 40: 32 findings share 16 elements and one edit closes two or three of them
at once.

Branch: `fix/sonar-reliability-interactions`, merged locally into
`development` after the checks, per the workspace branch policy.

## Findings map

| Commit | Unit | Findings | Lines |
| --- | --- | --- | --- |
| 1 | `fix(ui)`: ConfirmDialog backdrop | 4 | `confirm-dialog.tsx:71,79` |
| 2 | `fix(ui)`: contact form backdrop | 4 | `contact-form-modal.tsx:78,86` |
| 3 | `fix(feedback)`: announcement modal backdrop | 4 | `feedback/page.tsx:137,145` |
| 4 | `fix(admin)`: create-user modal backdrop | 4 | `admin/users/page.tsx:887,891` |
| 5 | `fix(whats-new)`: backdrop | 2 | `WhatsNew.tsx:47` |
| 6 | `fix(tour)`: onboarding backdrop | 2 | `OnboardingTour.tsx:65` |
| 7 | `fix(chat)`: sidebar overlay | 2 | `chat/page.tsx:324` |
| 8 | `fix(feedback)`: entry row activatable | 4 | `feedback/page.tsx:739,748` |
| 9 | `fix(chat)`: conversation row activatable | 2 | `chat/page.tsx:378` |
| 10 | `fix(flashcards)`: card activatable | 4 | `flashcards/page.tsx:310,336` |
| 11 | `fix(grammar)`: locale-aware category sort | 1 | `grammar/page.tsx:70` |
| 12 | `fix(auth)`: duplicate verify-email error branch | 1 | `verify-email/page.tsx:38` |
| 13 | `fix(legal)`: duplicate privacy landing branch | 1 | `privacy/page.tsx:33` |
| 14 | `fix(legal)`: duplicate terms landing branch | 1 | `terms/page.tsx:33` |
| 15 | `fix(audio)`: WAV header code points | 1 | `lib/audio.ts:21` |
| 16 | `fix(ws)`: strip trailing slashes without backtracking | 1 | `lib/conversation-ws.ts:16` |
| 17 | `fix(whats-new)`: `Number.parseInt` | 2 | `WhatsNew.tsx:22` |

Total 40.

## Fix patterns

These are design candidates, not approved implementation recipes. Each unit
must inspect its actual children and event propagation before choosing a
semantic structure. Prefer native controls where valid; never wrap a dialog
or nested controls in a button or a button role. A separate native backdrop
button and sibling dialog panel is a candidate for modal overlays. Preserve
existing visual tokens and verify layout rather than assuming equivalence.

### P1a — backdrop with Escape already handled

`confirm-dialog.tsx`, `contact-form-modal.tsx`, `feedback/page.tsx`,
`admin/users/page.tsx` already listen for Escape on `window`.

- Move the containment guard into the backdrop handler: close only when
  `e.target === e.currentTarget`.
- Delete the inner panel's `onClick={(e) => e.stopPropagation()}` handler.
- Evaluate a separate native dismiss button behind a sibling dialog panel,
  preserving stacking, accessible naming, focus trapping and focus restoration.
- Do not expose the container of the entire dialog as a button. Avoid adding
  a dismiss target to the focus trap unless its keyboard contract is deliberate.

Both source elements have findings; verify the exact closures by issue key
rather than promising a fixed count from the markup alone.

### P1b — backdrop without Escape

`WhatsNew.tsx`, `OnboardingTour.tsx` and `chat/page.tsx:324` have no Escape
handling. Same backdrop change as P1a, plus a `useEffect` window `keydown`
listener that closes on Escape, mirroring the pattern already used in
`confirm-dialog.tsx` and `contact-form-modal.tsx`.

### P2 — clickable row or card

`feedback/page.tsx:739`, `chat/page.tsx:378`, `flashcards/page.tsx:310`.

- Prefer a native button for a standalone action. Where the row contains
  other controls, separate the primary action from those controls rather than
  applying a button role to their common ancestor.
- Verify Enter/Space activation, accessible naming and focus visibility.

### P3 — interactive child inside a clickable parent

`feedback/page.tsx:748` and `flashcards/page.tsx:336` wrap an interactive
child in a `span`/`div` whose only job is `onClick={(e) => e.stopPropagation()}`.

- Remove unnecessary propagation handlers after separating primary and child
  controls. If delegation remains necessary, guard pointer and keyboard
  events consistently and do not match the current parent itself.
- Prove that voting, audio playback and other child actions never activate the
  parent action.

### P4 — single-line logic findings

- `grammar/page.tsx:70`: sort with `localeCompare` and the active language
  code, following `ConversationMode.tsx`.
- `verify-email/page.tsx:38`: collapse the duplicated `setStatus('error')`
  branches into one call.
- `privacy/page.tsx:33` and `terms/page.tsx:33`: the final `isFromLanding`
  ternary returns `/` on both sides; return `/`. `isFromLanding` stays used
  later in both files, so the production dead-code budget is unaffected.
- `lib/audio.ts:21`: `codePointAt`. Only ASCII chunk literals reach `writeStr`,
  so the WAV byte layout is unchanged.
- `lib/conversation-ws.ts:16`: use a backwards index scan and one final slice
  instead of the `/\/+$/` regex; test empty, slash-only and long inputs without
  repeated slicing.
- `WhatsNew.tsx:22`: `Number.parseInt`.

## Verification

Per unit: focused vitest for the touched suites, `pnpm typecheck`, `pnpm lint`,
delegated to `gentle-ai-verify`. Behaviour changes are test-first, RED then
GREEN. `verify-email`, `privacy`, `terms` and the WAV header change no
behaviour, so they carry no RED; they are covered by existing tests plus the
final scan.

Browser acceptance for the modal contract: `tests/e2e/confirm-dialog-keyboard.spec.ts`
drives the real build against the mock backend and asserts that the backdrop
closes on click outside, stays open on click inside, and closes on Escape.

Final gate: `pnpm quality:local` plus a SonarQube scan that must report 0 open
reliability findings. Run the scanner once on the final candidate (not only an
API query against an earlier analysis) and report server revision/branch
binding. `sonar.branch.name` is not configured, so a branch-scoped query may
not exist.

## Risks

- Production dead-code budget sits at 19/19 with no headroom: no new
  module-level exports anywhere in this work.
- Dialog dismissal must preserve confirming/loading guards and focus traps;
  bubbling keyboard events must not cancel while interacting inside a panel.
- Role changes and DOM restructuring can change assistive-technology and
  layout behaviour. Browser acceptance is required; absence of a tag change
  alone does not establish visual equivalence.
- Native review lineage `review-04324907af4b9a48` from the previous batch is
  still open without a verdict. Do not reset or recover it without explicit
  maintenance authorization.

## Execution status

Implementation authorized by the user: "ok ahora trabajalo". Progress is
recorded below: T1–T17 verified/committed; final gate/merge pending.
Work is single-writer delegated because each
unit touches behaviour and tests. Each unit closes with its own commit;
no push or remote PR is authorized.

Forecast: approximately 1,500–2,500 authored diff lines including tests.
Delivery is local-only, with 17 work-unit boundaries and bounded review
slices; no oversized remote PR will be created. First review base: `a524b24`.

- [x] T1: ConfirmDialog and Playwright acceptance — `5a4a97d`
  - Independent verifier `muryi3ks-1-s417`: RTL 7/7, typecheck/lint clean,
    Playwright desktop/mobile 2/2, scoped detector empty. Real hit testing,
    focus wrapping, Escape/Cancel and desktop focus restoration passed.
    Busy guard covered by RTL only; mobile opener restoration and screenshot
    visual inspection unavailable. Production build warnings non-fatal.
  - Native review not completed: ASSESS unassessable (untracked declaration),
    START refused with retained-selection-candidate-mismatch; no lineage
    created for T1. Do not reset previous authority. Independent checks stand;
    native preflight selection must be resolved before a later review.
  - Commit: `5a4a97dc8eac678344db8388efa504d83009e9b6` (262 diff lines).
  - Writer `murk0zns-d-olkm`: native sibling backdrop button and alertdialog;
    localized `common.close`, no exports/translation additions, busy guard
    and focus contract preserved. Three edit surfaces: component, RTL test,
    new Playwright spec. RED 3 failed / 4 passed; GREEN 7/7. Typecheck, lint,
    final formatting and whitespace checks passed.
  - Browser/independent verifier `murkgfcw-e-4j6n` was cancelled when the
    parent session shut down; no completed verification was recorded. User
    authorized resumption. Replacement verifier `muryi3ks-1-s417` checks
    interrupted server state, focused tests, typecheck, lint, desktop/mobile
    Playwright and scoped design detector. Replacement completed successfully;
    final acceptance evidence and commit are recorded above.
  - ASSESS: unassessable due to undeclared untracked scope; treat as high
    and require independent verifier. Native review outcome unknown.
  - Rollback boundary: `src/components/ui/confirm-dialog.tsx`,
    `tests/components/confirm-dialog.test.tsx`,
    `tests/e2e/confirm-dialog-keyboard.spec.ts`.
- [x] T2: Contact form overlay — `94c2328`
  - Independent verifier `murywbva-4-lkzm`: focused 7/7, typecheck, lint,
    Prettier all passed; no blocker. Real component/payload/error assertions
    inspected. T2 browser hit testing remains unverified. Commit
    `94c2328328dfb362ad303cfa2f0805cb9ef15adb` (103 diff lines).
    Native review unavailable; independent verification completed.
  - Writer `muryp84v-2-9zm5`: sibling native backdrop button and relative
    panel, propagation handler removed. RED 2 failed / 5 passed; GREEN 7/7,
    typecheck and lint passed. Formatting failed on the test file; not done
    and not committed at that point. Formatting-only follow-up
    `muryudhy-3-ukm2` completed: Prettier write/check passed, focused 7/7.
    Independent verifier `murywbva-4-lkzm` now running before commit.
  - Existing loading contract retained: backdrop/header/Escape can dismiss
    while inputs, Cancel and Submit are disabled. No new loading guards.
  - ASSESS unassessable with unavailable native outcome; independent
    verification required after formatting correction. Browser and Sonar
    evidence not yet available.
- [x] T3: Feedback creation overlay — `6d6df09`
  - Independent verifier `murz6sy0-6-cdvk`: focused 17/17, typecheck, lint,
    Prettier and whitespace checks passed. No blocker; source confined to
    CreateModal, T8 untouched. Committed as
    `6d6df09d97ff665892916d6dbd76d4d6e80ff80e` (102 diff lines).
    Native verdict unavailable; browser and Sonar closure remain pending.
  - Mapping correction: original lines 137/145 belong to CreateModal, not
    announcement/detail content. Only this overlay is changed; T8 row/voting
    handlers stay untouched.
  - Writer `murz0o0e-5-d5v1`: native localized sibling backdrop, relative
    panel, no propagation handler; existing Escape/autofocus/form/loading
    behaviour preserved. RED 3 failed / 14 passed; GREEN 17/17; typecheck,
    lint and final Prettier clean (initial formatting corrected). Two allowed
    files, 102 diff lines. No commit or Sonar closure yet.
  - ASSESS unassessable with native unavailable: independent verifier
    `murz6sy0-6-cdvk` running before commit. Browser hit testing unverified.
- [x] T4: Admin create-user overlay — `6f72dbe`
  - Independent verifier `murzkpup-8-v3qw`: PASS, focused36/36,
    typecheck/lint/Prettier clean; real component and settled deferred requests
    corroborated. Source confined to modal; all list/delete handlers unchanged.
    Commit `6f72dbe5e3ec6d6264353f04f2f5e80f4a95664e` (124 diff lines).
    No native verdict, browser acceptance or Sonar closure yet.
  - Writer `murzc68o-7-8p8u`: native localized sibling backdrop and relative
    panel; only overlay markup changed. RED 2 failed / 34 passed; GREEN36/36.
    Initial TypeScript test-index error and test formatting corrected;
    final typecheck/lint/Prettier passed. Diff124 lines in source/test.
  - Pending creation contract unchanged: only Submit disabled; fields,
    header, Cancel, backdrop and Escape remain enabled. No browser or Sonar
    closure claim. No commit yet.
  - ASSESS unassessable/native unavailable; independent verifier
    `murzkpup-8-v3qw` running before commit.
- [x] T5: WhatsNew overlay — `ad764eb`
  - Independent verifier `murzyt90-a-ur4m`: PASS8/8, typecheck/lint/format
    and whitespace clean. Real IntlProvider/component, stable callback and
    listener cleanup corroborated; T17 untouched. Commit
    `ad764eb6fd17e6f8d4e008a76d4b50c3b22d9b98` (145 diff lines).
    No native verdict or browser/Sonar closure claimed.
  - Writer `murzqvyb-9-y26h`: named native sibling backdrop, tabIndex=-1,
    visibility-scoped Escape listener with stable dismissal and cleanup.
    RED3 failed/5 passed; GREEN8/8; final typecheck/lint/Prettier clean after
    test typing/format corrections. Real IntlProvider tests cover storage,
    tour gating, entry ordering, rich text, explicit close and cleanup.
    T17 parseInt unchanged; no exports/dependencies/messages added.
  - ASSESS unassessable/native unavailable; independent verifier
    `murzyt90-a-ur4m` running before commit. Browser/Sonar closure pending.
- [x] T6: Onboarding tour overlay — `89f5061`
  - Independent verifier `mus0hh2c-c-gjfa`: PASS10/10, typecheck/lint/format
    clean; actual component/IntlProvider and once-only persistence/cleanup
    corroborated. Commit `89f5061179bb9f44dc02b92bc2adfa86c33adaa7`
    (148 diff lines). No browser/native verdict/Sonar closure claimed.
  - Writer `mus04xfe-b-n0a4`: native localized sibling backdrop and
    visibility-scoped Escape listener with stable existing dismiss callback.
    RED3 failed/7 passed; GREEN10/10; typecheck/lint/final Prettier passed
    after test wrapping correction. Diff148 lines in component/test only.
    Navigation/premium/mount/completion gates retained; `fl_tour_done='1'`
    written once. Actual contract dispatches no custom event.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus0hh2c-c-gjfa` running before commit. No browser/Sonar closure yet.
- [x] T7: Chat sidebar overlay — `2fbd949`
  - Final independent verifier `mus14s82-g-42v8`: PASS18/18,
    typecheck/lint/format clean. Event-time mobile guard and desktop focus,
    resize boundaries/cleanup independently corroborated; T9 untouched.
    Commit `2fbd949979c242445ea33e23c3c9f906c93bc8ca` (166 diff lines).
    Browser, Sonar closure and native verdict still unverified.
  - Writer `mus0mr3j-d-7m1k`: named native sibling backdrop retaining default
    tab eligibility; sidebar-open Escape listener with cleanup. Only two
    production hunks (effect/backdrop); T9 rows/delete and streaming untouched.
    Meaningful RED3 failed/12 passed after correcting baseline query mistakes
    (query-error run not RED); GREEN15/15, typecheck/lint/final format clean.
    Existing chat-memory suite reused; no new test file required.
  - Default tab order deliberate: direct dismiss action before sidebar controls;
    no new focus trap/restoration. RTL innerWidth is not mobile/browser proof.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus0wkkb-e-i1zh` running before commit. Responsive Escape scope requires
    inspection; no browser or Sonar closure claimed.
  - Verifier `mus0wkkb-e-i1zh`: focused15/15/typecheck/lint/format passed,
    but found desktop regression: sidebar starts open at >=768 and global
    Escape closes it despite md:hidden backdrop. T7 remains incomplete.
    Bounded correction `mus10m6z-f-y92i` adds event-time mobile guard and
    test-first desktop/input/resize regression coverage. Correction completed:
    RED3 new failed/15 passed; GREEN18/18; typecheck/lint/format clean.
    Event-time `window.innerWidth < 768` guard matches existing breakpoint;
    desktop768/1024 input focus and767->768->767 resize cases covered.
    Final independent verifier `mus14s82-g-42v8` running. No commit yet.
- [x] T8: Feedback primary and voting actions — `4e1e051`
  - Independent browser verifier `mus21uhb-k-kfnv`: RTL21/21,
    typecheck/lint passed; Playwright4/4 (feature/bug × desktop/mobile).
    Actual Tab/Enter/Space/focus outline, vote3->4->3 isolation, owned-delete
    cancellation/confirmation, viewport/overlap/text geometry passed.
    Unknown feedback endpoints aborted and none occurred; no real backend.
    Screenshots generated but image inspection unavailable; no pixel-level
    or focus contrast/centre-hit-test claim. Build warnings non-fatal.
  - Commit `4e1e051d272eb33abb2a3e75087bdce0d3b6da8d`:539 diff lines.
    Larger coherent unit because durable E2E fixtures/transport/isolation and
    responsive acceptance are included with behaviour; no code-golf or
    removal of checks to fit heuristic. Delivery local-only, no PR/push.
    Native verdict and Sonar closure still unverified.
  - Writer `mus1a9by-h-qnoq`: inert flex row and native primary action,
    sibling vote/delete controls, phrasing spans and token focus outline.
    T3 modal untouched. RED2 intended failed/17 passed; initial GREEN19/19,
    final expanded21/21. Typecheck/lint/final format clean after correction.
    Diff190 lines in page/test. No user-event installed; no synthesized-key
    claim of native Enter/Space acceptance.
  - Layout risk: bottom-aligned sibling delete column reduces primary text
    width on deletable entries; responsive wrapping/keyboard activation need
    actual browser inspection. No commit yet.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus1mdmi-i-50sr` completed:21/21/typecheck/lint/format passed, no
    source-level blocker. Mandatory browser acceptance outstanding: narrower
    title area, reduced padding hit target and native Enter/Space unverified.
  - Bounded follow-up `mus1r891-j-u1uw` creates durable
    `tests/e2e/feedback-actions.spec.ts` only, with isolated mock feedback
    endpoints, desktop/mobile keyboard/isolation/geometry assertions.
    No production/backend mutation or new dependencies; independent browser
    execution follows. Follow-up completed: typecheck/lint/final format clean;
    initial test indexing/format errors corrected. Two test scenarios per
    desktop/mobile, mock-owned/nonowned feature/bug entries and isolated
    feedback transport; normal Tab plus native Enter/Space, focus outline,
    vote/delete isolation, viewport/text geometry and screenshots.
    Independent browser verifier `mus21uhb-k-kfnv` running. No browser GREEN
    yet and T8 remains uncommitted.
- [x] T9: Chat conversation primary action — `d30b4db`
  - Final independent verifier `mus3buow-r-u8h2`: RTL21/21,
    typecheck/lint passed; Playwright desktop/mobile2/2 with all scenario
    checks reached. Actual Tab/Shift+Tab/Enter/Space, selected messages/GETs,
    inactive-delete cancellation/confirmation and active preservation,
    responsive Escape, focus outline/full opacity and geometry passed.
    Unknown intercepted requests empty in both projects; local mock only.
    Six screenshots produced, image inspection unavailable; no pixel/contrast
    claim. Build warnings non-fatal. Native verdict/Sonar closure pending.
  - Commit `d30b4db6c30cd2b64ad060c92cce171b0c28a01e` (479 diff lines),
    coherent behaviour plus durable browser fixtures/tests; local-only delivery.
  - Writer `mus28jvh-l-49ii`: inert conversation row, native primary action
    and sibling delete button; focus outlines, truncation and active styling
    retained. Only conversation-row hunks changed; T7 untouched.
    RED3 new failed/18 passed; GREEN21/21, typecheck/lint passed.
    Required test formatting still failing, so partial/no commit.
  - Formatting-only follow-up `mus2qg7u-m-72d2` explicitly authorized to run
    formatter on the test file and rerun focused21/21/format checks.
    Completed: format/write/check exit0, focused21/21 unchanged. Independent
    source verifier `mus2sre1-n-sb0s` completed: focused21/21,
    typecheck/lint/format passed; native sibling controls, selected message
    fetch/send ID and inactive deletion isolation corroborated. T7 untouched.
    No source blocker; real dialog/keyboard/layout acceptance still pending.
    One isolated spec writer
    `mus2tgsg-o-gl4n` completed `tests/e2e/chat-actions.spec.ts` only;
    typecheck/lint/format passed. Native Tab/Enter/Space selection, inactive
    delete isolation/confirmation, mobile/desktop Escape and geometry with
    long titles, isolated chat endpoints, screenshots ready. No browser GREEN
    claimed by writer. Independent browser verifier `mus31154-p-j8en` active;
    no production changes during verification and no commit until acceptance.
  - Browser run `mus31154-p-j8en`: RTL21/21/typecheck/lint passed but E2E0/2.
    Desktop asserted opacity1 mid-transition (.0328112); mobile queried
    nonexistent accessible name Show chats (actual glyph name, title matches).
    Desktop geometry and focus reached; Enter/Space/delete actions not reached
    and not credited. Traces/error-context preserved in test-results.
  - Bounded harness correction `mus37t0w-q-r9a7` only changes mobile title
    selector and adds bounded auto-retry for final opacity1; all acceptance
    thresholds/actions retained. Correction completed: typecheck/lint/format
    clean; opacity still required exactly1 via expect.poll, mobile toggle
    queried by actual localized title/native button assertion. Source and
    endpoint interceptions untouched. Independent corrected acceptance
    `mus3buow-r-u8h2` running once; T9 still incomplete/uncommitted.
  - Changed hit boundaries require browser keyboard/layout acceptance before
    completion; native Enter/Space/Tab/visual focus not yet tested.
- [x] T10: Flashcard flip and audio actions — `4b25449`
  - Final independent verifier `mus4gq4x-x-ek94`: RTL12/12,
    typecheck/lint clean; desktop/mobile Playwright2/2 completed. Native
    Tab/Enter/Space, retained focus, minimum44x44/padding/outline, German/CJK
    containment and overflow passed. Original media play promise resolved
    with generated PCM WAV, exact TTS payload without flip, quality4 review
    POST and next-card front reset verified. Unknown intercepted endpoints
    empty; local fixtures only. Screenshots generated but image inspection
    unavailable; no physical speaker/device or pixel-equivalence claim.
  - Commit `4b25449f319b5554d4c7d4bad2f0fad0e5fc2222` (507 diff lines),
    coherent behaviour plus durable browser fixture/acceptance. Native verdict
    and Sonar closure remain pending.
  - Writer `mus3if73-s-lhwg`: inert card, existing reveal/hide labels on
    native flip button kept mounted across faces; independent audio control,
    no propagation wrapper. Card content/minheight/TargetLanguageText,
    grading/speech/generation logic retained. Two touched files142diff lines.
    RED5 failed/6 passed; initial GREEN11/11; expanded final12/12.
    Typecheck/lint/final Prettier passed after scoped formatting correction.
  - Whole-card hit area intentionally narrowed to header action: browser
    discoverability/geometry/Tab/Enter/Space acceptance required before commit.
    RTL audio isolation uses native test double, no actual TTS proof.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus3sv2i-t-e0d7` checks source/tests and maps minimal browser fixtures.
    No commit, browser/Sonar/native closure yet.
  - Independent `mus3sv2i-t-e0d7`:12/12/typecheck/lint/format passed;
    confirms real button identity/focus and no nesting, but caption-only
    action lacks deliberate touch dimensions/affordance. Bounded follow-up
    `mus3xsjj-u-m10q` adds minimum44px native target and token affordance,
    unit regression and isolated `tests/e2e/flashcard-actions.spec.ts`.
    Browser fixtures must provide valid generated PCM WAV, not existing
    three-byte mock audio; real TTS request/audio isolation and native keys,
    long/CJK layout and grading reset required before commit.
  - Follow-up `mus3xsjj-u-m10q` completed: min44px/padding/token border/hover,
    wrapped header/CJK audio layout. RED1 failed/11 passed; GREEN12/12;
    typecheck/lint/format passed. New E2E spec uses German UI/Japanese cards,
    generated mono PCM WAV and original media play promise observation.
    Browser not run by writer. Independent verifier `mus491sq-v-yn6e` now
    executes desktop/mobile acceptance; no commit until observed outcome.
  - Verifier progress: focused12/12/typecheck/lint passed. Playwright exited1
    before collection because Node JSON import lacked type:json attribute;
    no browser assertion, screenshot or final transport check reached.
    Bounded spec-only loading correction `mus4cvac-w-9n82` adds compatible
    typed JSON loading and --list collection check; no source/config changes.
    Correction `mus4cvac-w-9n82` completed: localization parsed as unknown
    via Node readFileSync, required string labels validated at runtime.
    Typecheck/lint/format and --list passed:2 desktop/mobile tests collected.
    Assertions/transport/media observation unchanged; no browser GREEN.
    Independent corrected browser run `mus4gq4x-x-ek94` active once; this
    follows evidenced harness correction, not a blind retry.
- [x] T11: Locale-aware grammar sorting — `53215da`
  - Independent verifier `mus4tazg-z-mpar`:10/10/typecheck/lint/format
    passed, no blocker. Raw category semantics and same-reference memo
    invalidation corroborated; comparator spies restored by setup. RED is
    comparator-contract evidence, not changed rendered ASCII ordering.
    Commit `53215da71d17007fd4ae61cce4c5683cbc838dee` (76 diff lines).
    Sonar closure/native verdict still pending.
  - Writer `mus4n4pk-y-8z0a`: explicit raw-category comparator
    `a.localeCompare(b, activeLanguage?.code ?? 'en-GB')`; memo dependency
    includes active language code. Category labels rendered raw, not translated;
    preserve this contract. Fourteen valid enum values ASCII; no invalid
    Unicode fixtures. RED3 failed/7passed because comparator not invoked,
    ordering equivalence already passed; GREEN10/10, typecheck/lint/final
    format passed after test formatting correction.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus4tazg-z-mpar` running. No commit/browser/Sonar closure yet.
- [x] T12: Verify-email duplicate error branch — `f0dec34`
  - Independent verifier `mus589zo-11-lym4`: PASS7/7, typecheck/lint/format
    clean. Catch-only equivalence and unchanged token/timeout/signal/cleanup
    corroborated; abortable mocks settle and assert zero timers. No blocker.
    Commit `f0dec3489c0bf8f0526050908735327f542f65c3` (166 diff lines).
    Real email/API/browser/Sonar/native verdict not established.
  - Writer `mus4z2jh-10-xofz`: catch-only simplification to one
    setStatus('error'), unused error argument removed. No behavior change:
    equivalence tests7/7 before/after, no meaningful RED claimed. Success,
    nonOK/generic/AbortError, encoded/missing token, timeout15s/unmount covered
    with settled abortable mocks and cleared timers. Typecheck/lint/final
    format clean after test indexing guard/format correction.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus589zo-11-lym4` running before commit. Real email/API/browser/Sonar
    closure not claimed.
- [x] T13: Privacy duplicate navigation branch — `4edc03d`
  - Independent verifier `mus5lxfy-13-l13h`:8/8/typecheck/lint/format
    passed, no blocker. One-expression production equivalence and eight
    real-page URL/label/content/config cases corroborated. Commit
    `4edc03df7781f3730a00b8fea384c737111eddd4` (167 diff lines).
    No browser/live API/Sonar/native verdict.
  - Writer `mus5e7ow-12-mu08`: one-expression backHref fallback '/';
    settings/register/invite priority and encoded URLs unchanged. Mapping
    clarification: isFromLanding remains for termsHref, not backLabel.
    Baseline/post/final equivalence8/8; no meaningful RED. Typecheck/lint/
    final format passed after test formatting correction. Eight real-page
    cases cover content/labels/cross-links/config and invited disabled signup.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus5lxfy-13-l13h` running before commit. No browser/liveAPI/Sonar closure.
- [x] T14: Terms duplicate navigation branch — `4872415`
  - Independent verifier `mus5yglg-15-znn1`:8/8/typecheck/lint/format
    passed; one-expression URL equivalence and legal/cross-link/config
    contracts corroborated. Commit
    `4872415ac4684065e2071988551989f4ef85bc0c` (165 diff lines).
    No browser/liveAPI/translated-copy/Sonar/native verdict.
  - Writer `mus5rar4-14-cdwv`: one-expression final backHref fallback '/';
    original routes/invite/config/labels/privacy cross-link and content intact.
    Baseline/post/final equivalence8/8, no meaningful RED. Typecheck/lint/
    final format passed after test formatting. Tests actual Terms11sections,
    four list items, eight origins/config/invite cases.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus5yglg-15-znn1` running before commit. No browser/liveAPI/Sonar claim.
- [x] T15: WAV header code-point equivalence — `c878417`
  - Independent verifier `mus6b9my-17-0act`: PASS19/19,
    typecheck/lint/format clean. Only codePointAt/bounds comment changed;
    four ASCII literals equivalent. Independent literal byte fixtures
    corroborated, original17 cases unchanged. Commit
    `c878417c2ca6de832840f172a46ffc50b6b81609` (67 diff lines).
    No scanner/media/device/native verdict.
  - Writer `mus6496j-16-r8a8`: minimal ASCII chunk writer replacement with
    codePointAt(i) ?? 0 and bounds justification; four constant ASCII call
    sites retain offsets, all sample/queue APIs unchanged. No meaningful RED:
    original17/17, expanded pre-change19/19, post-change19/19. Added complete
    exact-byte empty/nonempty WAV fixtures; typecheck/lint/format passed.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus6b9my-17-0act` running before commit. No scanner/media/device claim.
- [x] T16: Linear trailing-slash removal — `132316c`
  - Independent verifier `mus6n6ac-19-4z4v`:15/15/typecheck/lint/format
    passed; monotone bounded scan, single final slice and all URL semantics
    corroborated. Added4096 terminal/adversarial suffix coverage; complexity
    O(n) by code inspection only. Commit `132316c1f6699b5ff84d30f8bbef3f0c58818bb2`
    (45 diff lines). No benchmark/Sonar/native closure.
  - Writer `mus6gv8n-18-3kxt`: trimmed URL backward index scan,
    monotonically decreasing until0/non-slash, one final slice. O(n) by
    inspection, not timing claim; no repeated slicing/backtracking regex.
    Preserve scheme/fallback/path/interior slashes. Nine new exact-output
    cases incl4096terminal/adversarial nonterminal slashes; baseline/post/
    final15/15 equivalence, no meaningful outputRED. Typecheck/lint/final
    format passed after test formatting.
  - ASSESS unassessable/native unavailable; independent verifier
    `mus6n6ac-19-4z4v` running before commit. Sonar closure pending.
- [x] T17: WhatsNew Number.parseInt equivalence — `83f3330`
  - Independent verifier `mus6xi14-1b-uj3t`:8/8/typecheck/lint/format
    passed; same substring args, radix omission and subtraction confirmed.
    Existing reverse-inserted entry10/entry2 verifies numeric order; entry10
    description asserted. T5 behavior untouched. Commit
    `83f33304fc52750ee79bf1b42afaa7756b7c6dc9` (3 diff lines).
    No native verdict/Sonar closure.
- [ ] Final gate, native review blockers, Sonar confirmation and local merge — in progress
  - T17 committed `83f3330`. Independent final `pnpm quality:local` task
    `mus74wox-1c-fyhn` and read-only current Sonar measure task
    `mus75iyg-1d-cja8` completed: server currently reports 40 open
    reliability issues (16 S1082, 14 S6848, 3 S3923, 2 S6847,
    2 S7773, 1 each S2871/S7758/S8786). This is the old `development`
    analysis (2026-10-02T21:34:18Z), not an analysis of the 17 commits:
    the API does not expose their revision. Server gate ERROR includes
    new-code coverage 0.0% and 14 new violations; neither is attributed
    to this branch. The API read cannot substitute for a final scan.
    `mus74wox-1c-fyhn` completed `pnpm quality:local` once: all steps pass,
    113 files/1176 tests, coverage statements87.17%, branches81.97%,
    functions82.41%, lines88.85%; dead-code18/19 full and19/19 production;
    CRAP13 high-risk, max120.31 within budget. Tooltip flake did not recur.
    Final scanner task `mus7dqrv-1e-bskw` completed once. CE task
    `15991712-b296-46af-a066-ac9970bee7cd` processed SCM revision
    `83f33304fc52750ee79bf1b42afaa7756b7c6dc9`, matching local HEAD. Quality
    gate FAILED; scanner has no `sonar.branch.name`, so server branch binding
    remains unproven/default project analysis. Bearer API handoff returned
    empty/null responses for issues/branches/gate; reliability counts and
    condition details cannot be confirmed. The preceding stale development
    API query showed40 but is not final-candidate evidence.

## Final status and blockers

- T1–T17 have individual commits on `fix/sonar-reliability-interactions`.
- `pnpm quality:local` passed: 113 files/1176 tests; coverage
  87.17/81.97/82.41/88.85 (statements/branches/functions/lines), dead-code
  18/19 full and19/19 production, CRAP13 high-risk/max120.31 within budgets.
- Final Sonar scan uploaded exact HEAD but its server quality gate FAILED.
  Revision matches; branch identity and open reliability issue count are not
  independently confirmed because API returned empty/null data and branch
  name was not supplied.
- Native review verdicts were not obtained: prior T1 START refused before
  lineage due retained selection mismatch; subsequent ASSESS calls were
  unassessable because the ODD document is untracked. Do not reset/recover
  existing authority without explicit maintenance authorization.
- Subsequent read-only Sonar retrieval confirmed the server's development
  analysis dated 2026-10-03T09:43:33Z reports reliability0/security0 and
  maintainability393. This confirms current server measures, not historical
  revision linkage or native approval. Previous failed gate and native review
  limitations remain recorded above.
- User explicitly authorized local merge: "mergealo a development local y
  luego trabaja". Preserve this ledger in Git and fast-forward local
  development to the verified work. No push or remote operation authorized.
  The next feature addresses maintainability in eight category commits.
- [ ] Final gate, Sonar confirmation and local merge

Track each unit with issue keys, source paths, test evidence and its commit
identity. Browser acceptance belongs to unit 1. Final quality checks and
SonarQube confirmation precede the requested local-only merge.