# SonarQube maintainability by category

## Authorization and baseline

User authorized correction of all 393 open maintainability findings with one
commit per category (eight category commits). User explicitly authorized local
merge of prior reliability work first. Local development was fast-forwarded to
6e17ace, including the preserved reliability ledger; no push occurred.
Feature branch: fix/sonar-maintainability-categories, based on local development.
Previous native-review and server gate limitations are not native approvals.

Baseline: default server development analysis 2026-10-03T09:43:33Z;
393 unique unresolved maintainability issues, LOW150/MEDIUM211/HIGH32;
reliability0/security0. Refresh issue evidence before each category.

## Execution and commit contract

Exactly one implementation commit per category, with tests and applicable docs.
Use bounded internal batches for large categories but do not commit batches
separately. Single writer at all times; narrow edit surfaces derived by parent
from read-only mapping. Technical artifacts English, existing UI locale intact.
User knowingly requested large category commits; local-only delivery, no PR or
push. Forecast roughly 3,000–8,000 authored diff lines including tests, uncertain
until per-category mapping. Category boundaries are review boundaries, not
license to skip testing. Avoid mechanical fixes that change business semantics.

## Tasks (execution order)

- [x] C1: Deprecated APIs and import hygiene — S1874/S3863, 20 baseline
  - BatchA baseline/post193tests and static checks passed. Recorder independent
    final53/53 and desktop4/4 passed; native manual/autostop PCM16kWAV plan42,
    once-only upload/review, cancellation and genuine missing-module rejection
    verified.3000ms ACK boundary covered by unit tests. Fake microphone/local
    fixtures only: no mobile/physical-device/liveSTT/deployment acceptance.
  - One category commit includes all source changes, worklet, tests and ledger.
    Commit c8acd0d4576cb003a4901122d4c9b862f7f21d1f (18 files,
    2081 authored diff lines including ledger and browser/race tests).
    Sonar closure still awaits scan. Native ASSESS medium, reviewDue
    slice_budget_reached. Lineage review-e322108d51b55d7a started for exact
    category; one reliability reviewer forecast/run failed empty-output,
    stopReason:length (~171s), no verdict/mutation/approval. Fresh STATUS
    reviewing/collect reoffers slot; no automatic replay or authority reset.
    Independent functional acceptance stands; native review unavailable.
- [x] C2: Modern JavaScript/TypeScript APIs — `589b7ea`, 18 baseline
  - Independent verifier musmkh23-1w-gmdq: 11 files/156 tests passed,
    typecheck/lint/format clean. All18 minimal rewrites and four related test
    surfaces inspected; no blocker or introduced mock leak. Commit
    589b7ea28d1e07a5fed08d564798f14d8c9435e6 (17files169diff lines).
    Committed ASSESS medium, reviewDue=false/under_budget; native outcome
    unknown, deferred to bounded slice. No Sonar closure yet.
  - Mapper muslpd4t-1u-4e0b verified18findings/12sources, server baseline393
    unchanged (not C1scan). Writer muslzqg3-1v-pi1w applies only mapped
    expressions plus directly related characterization tests; no commit yet.
  - Preserve falsy/nullish semantics: object/array initialization??=,
    completion score??0, strictverifiedfalse and socketOPEN conditions.
    .at(-1) preserves UTF16 codeunits; String.raw replacement exactlyone
    backslash, Set string membership only; local localeincludes accommodation.
    PCMforof retains exactclamp/endian/offset and ASCIIheaderunchanged.
    Baseline/post equivalence required, no inventedRED.
  - Writer muslzqg3-1v-pi1w completed18closure candidates/12sources plus
    four characterization test surfaces. Expanded baseline/post156/156,
    typecheck/lint/final format clean; initial weak-skill label matcher and
    four formatting drifts corrected, neither counted behaviouralRED.
    Existing source/UI/socket/WAV contracts preserved; no C2commit yet.
  - ASSESS unassessable due untracked new test/outcomeunknown; independent
    verifier musmkh23-1w-gmdq running focused156/static checks and semantic
    diff inspection. Server still baseline393 until a scan, no closure claim.
- [x] C3: Error messages and stringification — S7722/S6551, 15 baseline
  - Independent unit180/180 and static checks passed. Browser verifier
    mustk1hi-21-glty:12/12 desktop/mobile scenarios passed, all final assertions
    reached. Safe alert/nondisclosure, two-request native retry, exit-dialog
    keyboard/focus and invitation URL verified. Submission evidence is enabled
    controls, not completed submission; typed number/boolean unit-only.
    Geometry-only, no screenshots/contrast/physical-device claim. Nonfatal
    build warnings and aborted-request ECONNRESET observed, no failed assertion.
    Commit18df30540ac5eb2c6dbd550bb3878ff563c98422 (27files658diff lines).
    Native review of C2+C3 slice (basec8acd0d,825diff lines) approved and
    acknowledged: lineage review-8b38a3f634820ebf, exact authority burned.
    Four suggestions R3-A1..A4 informational only, no correction or re-review
    transition; do not expand scope on that metadata. C1 review remains without
    verdict. Sonar closure still awaits final scan.
  - Mapper musmsilp-1x-s4m2 verified12missing Error diagnostics and3unsafe
    coercions across8sources; server393baseline, not scanned C1/C2.
  - User decisions: invalid present lesson explanation containers/text must
    show localized safe error and recovery where existing generation permits,
    not silently become absence. Valid string and original missing/null/empty
    contracts preserved; selection context equals validated displayed text.
    Router retains boolean compatibility with string/number, omitsnullundefined,
    rejects object/array/unsupported with constant non-sensitive diagnostic.
  - Writer musspfp2-1y-4f89 handles mapped sources/tests and necessary localized
    message keys only; one writer, no C3commit until checks. New semantic
    behaviour test-first; constantError messages baselineequivalence.
    Never echo query keys/values, payloads, usertext or credentials.
  - Writer musspfp2-1y-4f89 completed12diagnostics plus validated lesson/
    router contracts and15locale invalidExplanation keys. Baseline159/159;
    RED14intendedfailed/165passed, final180/180 across10files. Typecheck/lint/
    final scopedformatpassed. Intermediate existing multiplechoice test failed;
    fragment-preserving mock correction recorded, not hidden.
  - Native preflight while writer active stopped before lineage on newrouter
    untracked selection; no candidate frozen/approval. ASSESSunassessable,
    independent must44ze-1z-ygcd now validates semantic diff,180tests/static
    and maps browser invalid-alert/native-recovery/navigation acceptance.
    No C3commit or server/native/browser closure yet.
  - Independent must44ze-1z-ygcd completed180/180/typecheck/lint and semantic
    inspection: no blocker. Safe constant errors, validation/absence contract,
    immutable native recovery, same display/selection text,15locale keys,
    router primitive/privacy constraints and fragment mock corroborated.
  - Browser harness writer must9r88-20-e1ts adds only
    tests/e2e/lesson-explanation-errors.spec.ts: real mock-auth, isolated
    lesson/nativegeneration fixtures, visible alert/nondisclosure/retry and
    desktop/mobilegeometry. No new productionroute/routerfixture. Typed
    number/boolean serialization remains actualrouter unit evidence, not
    browser-navigation claim. Harness must9r88-20-e1ts completed onlynew
    spec, typecheck/lint/format/listpassed:6scenariosx2projects=12collected.
    Native retry2requests/alertdisclosure/choiceusability/exitdialogfocus and
    stringinvitenavigation ready. Independent mustk1hi-21-glty now runs
    typecheck/lint and desktop/mobile12scenarios once. No browserGREEN yet.
- [x] C4: React component/props contracts — S6759/S6478/S6767, 89 baseline
  - All five internal batches complete:15/14/12/12/4 source files, total57
    mapped sources,2 exceptional test files. Type-only no fabricatedRED;
    Paywall nested identity meaningful RED4 failed/83passed then GREEN87/87,
    including compact/full checkout/recovery focus continuity.
  - Independent verifier musx7cvn-2c-773b: combined40files/454tests,
    typecheck/lint/scopedformat/whitespace clean, no blocker. All60changed
    paths inspected:57sources+2tests+ledger. No new visual browser claim;
    worktree/source scope aligned with category, exact issue key resolution
    still awaits Sonar scan. Historic RED is writer-reported, not replayed by
    verifier; batch tests overlap and are not summed.
  - Native exact5e68745d lineage review-b66439f433d73d6a frozen60paths/
    675diff lines, captureapproved and acknowledged/authorityburned. This is
    only that frozen workspace candidate, not a blanket approval of future
    commits/changes. Earlier drifted approved captures unburned; no reset.
  - Single category commit a29965077cba192bd6f7823b4d6004e86cf249f1
    (60files694diff lines) completed with tests+ledger. Committed ASSESSmedium,
    reviewDue slice_budget_reached. Exact committed review lineage
    review-7083de281a06cc8f started, one reviewer hostrelay failed
    emptyoutput stopReason:length~95s; freshSTATUS reviewing/collect,
    no verdict/ack/authorityburn. Independent combined454tests/typecheck/
    lint/format alreadypassed; native on exactcommit remains unavailable.
    Sonar closure awaits scan; no claim of final approval.
  - Read-only mapper mustwtru-22-hk00 derives exact57file surfaces,
    readonly/generic/ref type patterns, two nested-component identity issues
    and unused prop/caller contract. Internal bounded batches share one C4
    commit. Mapper completed89issues/57exact sources, baseline393unchanged.
    Five internal batches partition15/14/12/12/4files. First batchA writer
    musu5ik2-23-7w8c modifies only15component parameterannotations shallow
    Readonly<Props>/single inline readonlyfields; baseline/post typeequivalence.
    Runtime bodies/domainobjects/arrays remain mutable where currently needed.
    No C4commit until all batches/checks. Next review boundary18df305.
  - BatchA musu5ik2-23-7w8c completed15readonly parameter boundaries;
    baseline/post89/89,typecheck/lint/final format passed. Runtime/interfaces/
    callers unchanged; no directcoverage promised for every mockedcomponent.
    Native slice f89dbc96 lineage review-79372035fe977ec8 approved on capture,
    but acknowledgement blocked not-current after signatureformat drift:
    authority not burned; no approval of final C4 inferred, no reset/recovery.
  - BatchB writer musui123-24-p36z now handles14route/page inlinepropsfiles
    only, baseline/post equivalence; batchA retained, oneC4commit atfinish.
    Baseline136tests/15files passed. Parent paused writer after8annotations
    across3sources for native reminder; no postchecks at pause.
  - Native current slice started review-d28c82f3551e8e66 (19paths90diff
    lines, target273404a4) after scope advanced beyond reminder target.
    One forecast/run failed reviewer-empty-output stopReason:length~86s;
    freshSTATUS reviewing/collect, no verdict orack. No replay/reset/recovery.
    Parent released own writehold; resume writer musuqktz-25-cj04 finished
    all14sources/21readonlyannotations. Baseline/post136/136,typecheck/lint
    passed; five source signatures formatfailed, no writes during reviewhold.
    Earlier review unavailable, not userdeclined.
  - Stable A+B preformat targetd58b4f2b review-9c1d71efe8a285b9 started
    natively (30paths134diff lines), reviewerapproved and exactacknowledgement
    succeeded/authorityburned. Scope is exact preformatA+B, not finalC4.
    Parent releasedhold; formatter followup musv0z0e-26-7y8a corrects only
    five warned signatures, all14format/typecheck/focusedpost required.
  - New reminder exact5c829b91 formattedA+B target reviewed while writes
    paused: lineage review-76aaad23f263b5de,30paths158diff lines. Forecast1
    reliabilityrun, capture failed revieweremptyoutput:length~101s; fresh
    STATUSreviewing/collect, noverdict/ack/reset. Prior d58bapproval remains
    scopedpreformatonly. Parentreleasedhold, musv9b4n-27-us0j validates final
    BatchBformat/type/lint/focused136; no C4commit.
  - Exact9fcd6905 reminder reviewed while writespaused: lineage
    review-41a1a552f83fdf2f,30paths164diff lines; captureapproved and exact
    acknowledgement completed/authorityburned. Applies A+Bscopeonly.
    Final BatchB musvh1ru-28-vlb0:21annotations/14sources, finalall14format/
    typecheck/lint/136tests passed, no further sourcewrites. Category remains
    uncommitted; noreset/recovery.
  - Exact41a5d3f9 lineage review-215cd0468b714d34 capturedapproved and
    acknowledged/authorityburned; scope A+B only, not final C4.
  - BatchC writer musvp5zb-29-vy3r active:12 UI adapters/controls shallow
    readonly props boundaries, AppLink full inherited HTML props; preserve
    C1 VoiceRecorder runtime. Baseline/post focused/static, uncommitted.
  - Exact1f601071 reminder started review-064a4aa7b8315b08 over A+B
    tracking drift (30paths175diff lines), reviewer approved and exact
    acknowledgement completed/authorityburned. No finalC4 approval implied;
    BatchC writer continues. No native reset/recover or source mutation from
    review.
  - Exact7466d6a0 native review-badeee7c605b73fb capturedapproved during
    BatchC edits but candidate drifted before acknowledgement. Native returned
    acknowledgement-not-current, mutation=false, authority NOT burned. The
    approval cannot be projected onto current C4; no reset/recovery or replay.
    Continue bounded worker and review the stable final category boundary.
  - BatchC musvp5zb-29-vy3r completed12readonly UI adapter boundaries;
    baseline/post117/117,typecheck/lint/format passed. Formatter reordered
    preexisting focus-visible class in exercise-audio-player.tsx without
    intended styling change; parent readback identified the exact reorder.
    C1 recorder runtime unchanged. No fullsuite/browser/scan yet.
  - Exact40c1b420 native review-170873f6e70bc1e5 scoped A+B+C snapshot
    (42paths219diff lines) capturedapproved; boundSTATUS approved and exact
    acknowledgement completed/authorityburned. Six advisory findings
    informational only (AppImage,AppLink,layout,TargetLanguageText,ThemeProvider,
    tasklog); no correction transition, no finalC4 approval inferred.
  - BatchD writer muswdsya-2a-fvjt now handles12 primitive/grouped component
    sources with vendor/ref types preserved, focused baseline/post. One C4
    commit only after exceptional batchE and final independent checks.
  - BatchD muswdsya-2a-fvjt completed33shallow readonly boundaries over12
    sources; baseline/post/postformat69/69, typecheck/lint/final format clean.
    Runtime/vendor/ref logic unchanged; no tests edited. Work paused before
    native exact c796c3ef snapshot review-00e8943d0a2d5122 (54paths350diff
    lines). Reviewer returned emptyoutput stopReason:length~87s; freshSTATUS
    reviewing/collect, no verdict/ack/mutation. Hold released for batchE,
    no reset/recovery/replay of this capture. FinalC4uncommitted.
  - Exact82eb92f6 reminder started review-04b77310600554f3 over A+B+C+D
    tracking snapshot (54paths357diff lines), reviewer captureapproved but
    candidate drifted before acknowledgement; native not-current, mutation
    false/authority unburned. No approval projected onto newerE changes,
    no reset/recover/replay. Review stable final category commit instead.
  - BatchE muswscsj-2b-gwjs completed four exceptional source paths plus
    BillingPaywall/WhatsNew tests: PaywallContent module-scope readonly
    presentation, parent hooks/state/async handlers preserved; t.rich stateless
    bold callback hoisted; unused MicButton sessionActive typedprop and one
    caller attr removed; readonly boundaries. Baseline83/83, meaningful
    Paywall node/focus identity RED4failed/83passed, GREEN87/87; typecheck/
    lint/format passed. No browser/full suite yet.
  - Exact288ef9f3 reminder START selected updated target0883d28a A-E60paths/
    662diff lines. Native review-c77fb1f665e5fd55 captureapproved and exact
    acknowledgement completed/authorityburned for that frozen candidate;
    no final committed C4 receipt inferred. Independent verifier
    musx7cvn-2c-773b now checks combined affected suites/static/diff and
    browser risk before one category commit; Sonar closure pending.
  - Exceptional batchE: PaywallContent actually nested, extract module-scope
    readonly presentation preserving parent stores/hooks/state/async lifetimes,
    meaningful DOMidentity/focusRED. WhatsNew t.rich bold callback captures
    nothing/no mountedstate, module-scope render callback equivalence only.
    MicButton unused sessionActive prop remove declaration and single caller
    attribute only, preserve parent sessionstate/guards; no invented policy.
- [x] C5: Test structure and conventions — source/test work complete
  - User explicitly requested closure: "Cierralo". One category commit
    includes all 18 test surfaces and this ledger; no merge or push.
  - Final independent unit checks: 17 files / 407 tests passed, typecheck,
    lint and all 18 test-file formatting checks passed.
  - Final browser verifier muu3damh-8-o78v: typecheck/lint/format passed;
    Playwright 12/12, no skips, all 38 desktop + 38 mobile route checks and
    final accumulated framework/page/CSP-error assertions reached and passed.
    Fixture-backed empty/error/404 states are intentionally tested; no live
    backend, physical-device, pixel-perfect or deployment acceptance claimed.
  - Four AudioPlayer fake-timer rejection act boundaries remain deliberately
    intact. Necessary async settlement acts are not suppressed. Therefore
    closure of every baseline Sonar finding is NOT claimed; scan/triage remains
    pending. Final code-review attempt review-604bf5f5d9b33e9b failed host
    transport (request timeout), no admitted verdict or approval for final C5.
    Earlier snapshot receipts do not substitute for a final committed review.
  - This final closure record supersedes intermediate 'pending route' statuses
    below; historical failed runs are retained as evidence.
  - Mapper musxn10w-2d-1lrf validated54 unique open findings/18 paths and exact
    counts. Initial safe batch only tests/components/AudioPlayer.test.tsx:5
    synchronous fireEvent clicks at prior lines312,499,573,673,721. Keep act
    import, async fake-timer acts415/437/530/643, native callbacks/timer acts.
    Do not mechanically delete async completion boundaries.
  - migration.spec.ts S1607 skip already has reason, possible analyzer false
    positive not adjudicated; preserve pending explicit false-positive policy.
    S9332 networkidle requires positive readiness replacement; do not weaken.
  - Writer musxwpy7-2e-e8jw executes focused baseline/post single test-file
    redundant-act slice only; one eventual C5 commit, no configuration changes.
  - First batch musxwpy7-2e-e8jw completed four safe direct-click replacements
    in AudioPlayer.test.tsx (original312/499/573/721), baseline/post36/36 and
    Prettier clean. Mapped original673 replay is NOT synchronous: resolved
    fetch/blob/play; wrapper kept, remains unresolved pending async mapping.
    act import/nativecallback/timer wrappers kept. No commit or Sonar claim.
  - Exact5e82ce8b C5 partial snapshot review-9f9731700cd75a10 started;
    reviewer host relay emptyoutput stopReason:length~71s, fresh boundSTATUS
    reviewing/collect, no verdict/ack/reset/replay. User did not decline;
    review stable category boundary after checks.
  - Mapper musy445e-2g-mevb classified all remaining AudioPlayer wrappers:
    RTL eventact only flushes sync updates; async fetch/blob/play requires
    callback installation as completion barrier. Native onended/onerror and
    fake-timer advances retain act. HTTPrejection/faketimer, multiinstance
    and replay (incl original673) deferred. Six single-start sites current
    ~211/238/304/509/684/707 can use bareclick+await new audio onended/
    onerror function readiness via waitFor. Bounded writer musyaq62-2h-gh34
    implemented only six: bareclick plus waitFor new audio onended/onerror
    callback readiness (post play() promise), baseline/post36/36 and Prettier
    passed. Rejection/fake-timer/nativecallback acts kept; no C5commit.
  - Exact213fe72c snapshot review-a4e2e978a47919bd started; reviewer
    approved and bound acknowledgement succeeded/authorityburned for doc+
    AudioPlayer test at that moment. Scope is partial C5, not final category.
  - Bounded writer musyiynf-2i-ee3g now tackles seven multi-instance/replay
    async sites only; must observe NEW audio identity callback readiness,
    preserve nativecallback/timer/rejection acts and resolved error replay673.
    Batch musyiynf-2i-ee3g completed seven multiinstance/replay click
    replacements; each awaits a distinct newly constructed Audio instance
    with onended/onerror callback readiness. Baseline/post36/36, format clean.
    Native callbacks/timers/rejections/original673 still guarded.
  - Exact4c777ed9 snapshot review-3f6e45d1b4c718cd capturedapproved,
    boundSTATUS approved and acknowledgement completed/authorityburned.
    Scope only doc+AudioPlayer test at that snapshot, not final C5.
  - Writer musysuc7-2j-z6vd now examines six remaining fetch rejection,
    fake-timer and recovery/replay async click wrappers. Keep meaningful act
    if no deterministic await exists; no forced Sonar closure. One C5commit
    later after all18testfiles verified.
  - Writer musysuc7-2j-z6vd converted2 further wrappers: request-payload
    first playback and recovery replay after restoring real timers, awaiting
    new Audio identity plus onended/onerror installation. Baseline/post36/36
    and formatting pass. Four HTTP/network rejection wrappers under fake
    timers retained: ordinary waitFor unsafe and relocation of async act
    alone would not establish completion. Native callback/timer acts retained.
  - Exacte3bf9699 partial snapshot review-6fb5c198d7e94750 started,
    reviewer emptyoutput stopReason:length~90s, freshSTATUS reviewing/collect;
    no verdict/ack/reset/replay. Later final C5 independent checks required.
  - Exactb8a34ca3 partial snapshot review-f1e403f90d79aee6 approved and
    acknowledged/authorityburned for doc+AudioPlayer test only; no finalC5
    approval. Four fake-timer rejection wrappers remain justified until a
    deterministic equivalent exists; do not delete for a cosmetic count.
  - Read-only mapper musz3i5y-2k-x6dt classifies remaining17testfiles,
    S5906 assertion specificity/S5976 parameterization/S8782 hook scope,
    S1607 reasoned skip and S9332 positive readiness. Mapper completed
    remaining17files/29findings, no source writes; one tool-owned truncated
    /tmp output artifact was not deliberately created/cleaned. S5906 equality
    only, S5976 case-name/setup preservation, S8782 hook scope, S8980
    per-component async waits; S1607 skip already reasoned, possible analyzer
    mismatch (not adjudicated). S9332 requires positive readiness for all
    routes, not URL-only or absence-of-error.
  - Mapper mut0fvsg-2p-of37 inspected actual migration sweep:38paths, not39.
    Existing mobile skip reason claiming coverage above is not accurate for
    all38; mobile sweep is real coverage decision, not presumed falsepositive.
    Route readiness is static/loadedempty/error/redirect/polling-specific;
    `/plan` redirects to `/assessment`, `/vocabulary` needs response waiter
    registered before goto, billing success polls5/me with adequate timeout,
    chat sidebar opens manually on mobile. Positive signal for each route,
    not URL-only/generic h1/framework-error absence.
  - Writer mut0pbqb-2q-y335 completed tests/e2e/migration.spec.ts only:
    typed38-route positive readiness, removes mobile skip, preserves cookie,
    framework/page/CSP checks. Typecheck/lint/format/--list passed,12entries.
    Independent verifier mut14izj-2r-48cu now runs desktop/mobile38routes
    with production fixture; first run typecheck/lint/format passed, E2E
    10passed/2failed: both sweeps reached /onboarding after five routes then
    exact accessible button British English mismatch, actual name includes
    image alt 'en-GB British English'. Remaining32routes/final error sweep
    checks NOT reached, no acceptance claim. Artifacts/traces preserved.
    Bounded spec-only selector correction mut1g5z1-2s-dp44 completed:
    exact enabled button 'en-GB British English' matches observed image alt+
    visible label, preserves settled-data readiness; typecheck/lint/format/
    --list12 passed. Other37cases untouched. Independent mut1k15n-2t-jqw8
    now ran both desktop/mobile sweeps once:10other smoke tests passed;
    each route sweep completed10/38 then /dashboard readiness failed.
    Destination /dashboard correct; expected empty-assessment heading missing,
    observed existing-plan heading 'Your plan, at your pace' plus levelA1/day2
    of48. Onboarding and billing passed in both projects; remaining27routes
    and final page/CSP checks not reached. Bounded test-only dashboard
    selector correction mut1rohd-2u-bxo9 changed readiness to exact heading
    'Your plan, at your pace'. Mapper mut36yl1-2w-7h81 confirmed it matches
    preserved desktop/mobile snapshots; /api/study-plan/today returns200 A1/
    day1of48, dashboard shows day2. /current404 belongs to OTHER routes.
    Static checks on corrected bytes not independently observed; no browser
    pass yet. Predicted /assessment/level-test mismatch: start-warning dialog
    is open before missing plan validation. Writer mut3i2ga-2x-tg5w changes
    only that initial gate readiness to visible 'Before you begin' dialog+
    Start; preserves other37cases. Writer mut3i2ga-2x-tg5w completed scoped
    selector: exact alertdialog 'Before you begin' and dialog-scoped visible
    Start, no click. Typecheck/lint/format/--list12 passed. This establishes
    initial gate only, not question-bank/invalid-plan subsequent state.
    Independent mut3mqsh-2y-6rte now reruns static+desktop/mobile38route
    sweeps once. Completed result retrieved on user-authorized resume:
    typecheck/lint/format passed, browser10other tests passed/2sweeps failed.
    Both projects completed16/38routes (32/76 checks), stopped /feedback:
    exact failure text expected without rendered prefix✕, snapshot actual
    '✕ Failed to load. Please try again.'. First16destinations/readiness pass;
    remaining21perproject/finalerrorCSPchecks NOT reached. No sourcebug claim.
    Resume writer mutxbgv7-1-o384 corrects only evidenced readiness selectors,
    spot-checks remaining markup to avoid repeat speculative mismatches.
    No C5commit or full acceptance yet.
  - Exactadf92490 high-risk partial19path review-5d7f322f43762d8d
    four lenses approved and acknowledged/authorityburned. Scope exact
    candidate with dashboard selector at that moment, not final C5commit.
    Browser acceptance remains independent and must reach all38routes.
  - Independent test verifier mut21f5e-2v-htxl now checks 17focused Vitest
    files/typecheck/lint/format and preserving async completion contracts.
    No C5 category commit pending route browser result.
  - Independent mut21f5e-2v-htxl checked all18changed test paths:
    17Vitest files/407tests, typecheck/lint/18fileformat pass. Inspected
    AudioPlayer4 retained fake-timer rejection acts and newAudio callback
    readiness, WordTooltip hook scope, 12toHaveLength,5it.each/19names,
    verify-email14999+1ms, registration/onboarding/lesson completion. No
    semantic blocker; migration browser acceptance remains outstanding.
  - Exacta3b9e621 partial19path high-risk review-45f904c095023e8d
    four-lens group failed revieweremptyoutput:length~118s,0outputs;
    freshSTATUS reviewing/collect4, no verdict/ack/reset. Independent
    functional checks remain separate from native review.
  - Exact1d3b9893 partial19path review-ea171ad8822fde96 grouped4lenses
    failed revieweremptyoutput:length~120s,0submitted; freshSTATUS reviewing/
    collect4, noverdict/ack/reset/replay. The repaired migration test still
    requires actual all38route execution; don't conflate native result.
  - Exact5e470729 partial19path high-risk review-90036f673f555b4f
    grouped4lenses failed revieweremptyoutput:length~142s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset. Browser route
    acceptance still incomplete and is independent of native review.
  - Exactb7d8c68f partial19path high-risk review-9d5dae5c791fbf2d
    grouped4lenses failed revieweremptyoutput:length~89s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. The route
    suite is still separate and must finish before one C5category commit.
  - Exacte3ddda69 partial19path high-risk review-b516cd9e46011395
    grouped4lenses failed revieweremptyoutput:length~105s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Migration
    browser acceptance still outstanding independently.
  - Exact38fd6f81 partial19path high-risk review-3ac1acd8fde2e6ca
    four-lens group preparation failed review-risk Request timed out,
    0submitted/no mutation; freshSTATUS reviewing/collect4. No verdict,
    acknowledgement or automatic replay/reset; full browser gate remains
    independent and incomplete.
  - Exact421f23cc partial19path high-risk review-3c8286e36345e6b1
    grouped4lenses failed revieweremptyoutput:length~102s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Full
    browser migration sweep remains independent and not yet accepted.
  - Exact6045c15e partial19path high-risk review-2c062625c46f52b7
    grouped4lenses failed revieweremptyoutput:length~103s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Route
    acceptance remains a separate unmet check.
  - Exact4fe3cfac partial19path high-risk review-6a4b7dab417b372f
    grouped4lenses failed revieweremptyoutput:length~132s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. The route
    suite must finish independently before one C5category commit.
  - Exact5b7ee513 partial19path high-risk review-8394eb9f2e10f600
    grouped4lenses failed revieweremptyoutput:length~121s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Full
    migration sweep remains separate and not accepted.
  - Exact7de5df17 partial19path high-risk review-a5636fbe43e6ff3f
    grouped4lenses failed revieweremptyoutput:length~104s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Functional
    route acceptance still unmet; never substitute native review for it.
  - Exactbc4db1ec partial19path high-risk review-f1fe2eb11adef2df
    grouped4lenses approved and exact acknowledgement succeeded/
    authorityburned;3informational warnings, no correction route. Scope
    frozen pre-full38route browser acceptance, not final C5commit.
  - Exact591ce0ca partial19path high-risk review-13a22e0177fc5942
    grouped4lenses failed revieweremptyoutput:length~137s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Browser
    full route result remains independently required.
  - Exact244685d9 partial19path high-risk review-bb21ddf047dc6dde
    grouped4lenses failed revieweremptyoutput:length~107s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Full
    desktop/mobile route sweep remains independent before C5commit.
  - Exact0c89a023 partial19path high-risk review-3b66c662f2b35ec2
    grouped4lenses failed revieweremptyoutput:length~120s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. Full
    route result remains a separate functional check before C5commit.
  - Exact88cddd0e partial19path high-risk review-e73fadfacf8f4ccb
    grouped4lenses failed revieweremptyoutput:length~154s,0submitted;
    freshSTATUS reviewing/collect4, no verdict/ack/reset/replay. The
    functional route suite remains independent and not fully accepted.
  - Exact97f523f9 partial19path high-risk review-5524b69dd82c4142
    grouped4lenses preparation failed review-readability Request timed out,
    0submitted/no mutation; freshSTATUS reviewing/collect4, no verdict/
    acknowledgement/reset/replay. Browser route result still independent.
  - Exactf7d846c8 partial19path high-risk review-f34ba8e7417ecb7a
    grouped4lenses preparation failed review-readability Request timed out,
    0submitted/no mutation; freshSTATUS reviewing/collect4, no verdict/
    acknowledgement/reset/replay. Full browser route result still required.
  - Exact5fcafb43 partial19path high-risk review-3369f76ba54ea989
    grouped4lenses capturedapproved and bound acknowledgement completed/
    authorityburned. Four informational suggestions, no correction route.
    Scope only frozen C5 workspace before full route acceptance; no final
    category review or browser pass inferred.
  - Exactbc6b876b high-risk partial19path review-4835aeb3fbdb6e15
    grouped4reviewers, provider requested inferential refuter. FreshSTATUS
    refuter slot captured, CRITICAL migration-vocabulary-readiness claim was
    refuted, final stateapproved and exact acknowledgement succeeded/
    authorityburned. Other suggestions informational only, no correction.
    Scope frozen pre-dashboard/level-test readiness fixes; does NOT establish
    the full38route browser acceptance nor approve finalC5commit.
  - Read-only mapper mut36yl1-2w-7h81 checks dashboard readiness correction
    and fixture state mismatch before another independent desktop/mobile run.
    No C5commit until full route acceptance.
  - Exacta5537765 partial18path high-risk review-d1a179477dbdb899
    four-lens group failed revieweremptyoutput:length~106s,0submitted,
    freshSTATUS reviewing/collect4slots. No verdict/ack/replay/reset;
    independent checks and stable category boundary still required.
  - Batch2 muszdybo-2l-qk0g completed12 S5906 equality matcher rewrites
    across5files; await queries/counts retained, inequalities unchanged.
    Baseline/post145/145, typecheck/lint/format clean. No C5commit.
  - Batch3 writer muszm6ap-2m-rr9h parameterizes5 mapped S5976 groups
    preserving per-case names/setup/assertions; baseline/post same test counts.
    Batch3 muszm6ap-2m-rr9h completed five S5976 parameterized groups,
    19 named cases preserved with fresh per-rowsetup and assertions.
    Baseline/post120/120 across5files, typecheck/lint/format/whitespace pass.
    All C5 batches remain uncommitted for single category commit.
  - Exact791905a1 partial snapshot high risk from auth test, lineage
    review-30302d6e03f9b529, four lenses capturedapproved; while group ran
    batch4 writer modified additional tests, so boundSTATUS/ack returned
    not-current, mutation=false/authority unburned. Twenty-seven advisory
    suggestions are non-blocking frozen metadata and do not authorize scope
    expansion or re-review on that candidate. Preserve source/test progress,
    no reset/recovery; final stable category review remains pending.
  - Batch4 muszxrh9-2n-lqp6 completed7 S8980 sites across4testfiles,
    baseline/post85/85,typecheck/lint/format passed. ExerciseAudioPlayer
    success waits enabledPause after play; errors wait audioError+enabledPlay.
    Onboarding waits savedgoals+navigation, registration requires observed
    disabled loading then enabled afterfinally, lesson fresh/persisted UI
    restored explicitly. Native audio.emit/deferred promise/fake timers acts
    preserved. No C5commit or Sonar claim.
  - Batch5 writer mut06zo1-2o-h2xi now groups WordTooltip hooks and
    characterizes verify-email pending/settled fake timer boundaries;
    legitimate act retained unless deterministic replacement. OneC5commit.
  - Batch5 mut06zo1-2o-h2xi completed2files, baseline/post21/21 and
    typecheck/lint/format clean. WordTooltip hooks grouped at start of existing
    useWordSave describe, same scope/functions; native/timer acts retained.
    Verify-email render separated from named verificationRequest settlement;
    required async act awaits Promise.allSettled without fake clock advance,
    pending14999+1ms and abort/unmount acts retained. If S8980 still flags the
    necessary settlement act, rule mismatch needs Sonar triage, not weaker test.
  - Exact2432ba37 high-risk partial snapshot review-1d538c5e6abcb89a
    four-lens materialize forecast/run failed pi-host-relay Request timed out;
    no reviewers submitted or verdict, freshSTATUS reviewing/collect4slots.
    No replay/reset; independent checks and final stable category review.
  - Exactb649a1c8 partial19path review-ccf1f5451763d7e5 four-lens group
    failed revieweremptyoutput:length~96s,0outputs submitted; freshSTATUS
    reviewing/collect4, noverdict/ack/reset. Browser route verification remains
    blocked independently; don't treat review failure as browser pass.
  - Exactf50a8f67 high-risk partial19path review-c12f790e41f422a0
    grouped four lenses, capturedapproved and acknowledged/authorityburned.
    Scope exact pre-selector C5 snapshot, not repaired migration test or final
    category commit. Functional browser still blocked at /onboarding; native
    approval cannot substitute for its remaining route checks.
  - Exact91b5bf1e high-risk partial snapshot review-996d02bb53e6d3a1
    four lenses capturedapproved but candidate drifted during Batch5; native
    acknowledgement-not-current/mutation=false/unburned. No finalC5 verdict
    inferred; preserve authority, no reset/recovery/replay.
  - Exact7ea7a854 snapshot native high risk due tests/store/auth hotpath;
    lineage review-d208df7e1c9b4b97 grouped four lenses forecast/run,
    all outputs admitted, approved and exact acknowledgement succeeded/
    authorityburned. Scope only doc+11testpaths at that frozen moment,
    not final C5 nor future edits. No blocking correction.
  - Exactdb941310 partial AudioPlayer snapshot review-ed3a1e3072a02d7f
    captureapproved but candidate changed while S5906 batch writer ran;
    acknowledgement not-current/mutation=false/authority unburned. No final
    C5 approval inferred; no reset/recover/replay. Review stable category
    commit after scoped checks.
  - Native reminder exacte65c7ceb started doc-only low review-f19533241a15358f,
    but writer changed test before acknowledgement; provider not-current,
    mutation=false/authority unburned. No approval projected onto current C5.
    Wait for stable category boundary, no reset/recovery.
  - Mapper musxn10w-2d-1lrf derives exact18test surfaces, meaningful act
    boundaries, assertion/parameterization/hook/skip/networkidle contracts.
    No test source writes yet; internal batches, one C5commit.
- [ ] C6: List identity and DOM attributes — S6479/S7761, 48 baseline — in progress
  - User authorized "trabaja c6". Clean branch fix/sonar-maintainability-categories
    at5aff74ab402d4deb9fe8f1fde5c3c96ff4346a01; prior categories preserved.
    Read-only mapper muubav3m-9-w15m refreshes48baseline issues/14sources,
    derives actual domain identity/duplicates/static positions and dataset
    theme contracts before source edits. Internal bounded single-writer
    batches, oneC6commit; no random/render-time keys or hidden index workaround.
    Identity continuity/reorder tests first where meaningful, existing behaviour
    equivalence for static maps; no commit/merge/push/scanner yet.
  - Mapper muubav3m-9-w15m verified48baselineissues/14sources
    (46S6479+2S7761) with exact current-line mapping: static authored
    translation records require translationidentifier keys, never translated
    text; tour dots derive named steps; parser spans need immutable document
    offsets with repeated fragments; free-write-corrections parser already
    computes occurrence ranges then discards them. Theme dark means data-theme
    ATTRIBUTE ABSENT (prehydration script, CSS, listener cleanup depend on it).
    Entity lists (chat streamed messages, dashboard nullable lesson IDs,
    assessment text options, ID-less content schemas) need real identity
    contracts, not random/render-time keys or disguised indices.
  - First bounded batch muubk735-a-78of: ThemeProvider dataset reads/deletes
    plus equivalence tests, and WhatsNew entry.key identity with a real
    node-identity regression. Deeper entity contract mapper muubl2rd-b-7d6x
    runs read-only alongside. One C6commit; no production decision invented
    for ID-less content until mapper evidence returns.
  - Entity-contract mapper muubl2rd-b-7d6x verified from frontend plus
    read-only sibling backend sources: chat API transports only role/content,
    so identity must be allocated once at ingestion/send outside render and
    updaters and preserved across token/reset; voice handoff must stay
    role/content-only. Dashboard backend omits null-lesson-id upcoming cards and
    lesson uniqueness is plan+week+day+title, so keys must not switch on
    generation; use a plan-slot tuple, keep the completed-null fixture.
    Assessment option uniqueness is only enforced per bank, so level-test needs
    question-scoped option occurrences without changing text-based scoring.
    ID-less authored content uses immutable document-occurrence identity
    assigned BEFORE filtering (phrasebook audio already relies on authored
    ordinal), and free-write-corrections already computes ranges it discards.
    No persistent-ID migration needed for immutable documents.
  - BatchA muubk735-a-78of completed: ThemeProvider reads/deletes data-theme
    (dark = attribute absent) with four real-provider tests; WhatsNew uses
    existing entry.key with a meaningful DOM-identity regression after
    inserting an earlier numeric identifier. WhatsNew RED1failed/12passed then
    GREEN13/13; theme baseline12/12 equivalence; typecheck/lint/format clean.
    Independent verifier muubve8a-c-2ekx:13/13, typecheck/lint/format clean,
    theme dark=attribute absence and exact handler removal confirmed, WhatsNew
    production diff limited to entry.key with DOM identity after inserting an
    earlier numeric entry; existing storage/Escape/richtext checks preserved;
    tests clean globals/store/storage/attribute. No blocker, no Sonar/browser
    claim. Its untracked tests/lib/chat-messages.test.ts observation is the
    authorized concurrent batchB writer, not an incident; no cleanup needed.
  - BatchB muubwajx-d-ifwo completed: new src/lib/chat-messages.ts identity
    helpers allocating opaque IDs once at history ingestion and record creation
    outside render/updaters, chat state merged by stable identity across
    tokens/reset/done, React keys use identity, voice context explicitly
    role/content. Baseline21/21; RED exit1 (missing module, then allocation
    count0 versus6); GREEN25/25, typecheck/lint/format clean. Honest note:
    DOM continuity assertions already passed with index keys, so RED proved
    missing once-only allocation, not a key-induced DOM failure.
  - Independent verifier muuc61vg-e-fahs: 25/25 plus typecheck/lint/format;
    no allocation in render/updaters/tokens/reset; merge-by-id preserves
    duplicate content and object references; no local ID in voice context or
    chat POST; streaming gates, word selection, scrolling, error handling and
    conversation selection unchanged. Limit recorded: allocateMessageId calls
    crypto.randomUUID() without a fallback, consistent with the existing
    AudioPlayer convention in an app that already requires a secure context;
    no universal-runtime claim. No backend/browser/Sonar claim.
  - BatchC muuc7nl2-f-4q88 completed: dashboard lesson card key is a JSON
    tuple of language/planId/week/day/title that deliberately EXCLUDES the
    nullable lesson ID so the key cannot switch on persistence; assessment
    level-test keys are question-scoped option-text occurrences without
    deduplication, leaving order, prefixes, text selection and text-based
    scoring untouched; AdaptiveQuizCard untouched. Baseline15/15, meaningful RED
    2 failed/15 passed, GREEN17/17 with typecheck/lint/format clean after scoped
    formatting. Independent verifier muucu8b8-g-8aq7 accepted batchC: 17/17
    plus typecheck/lint/format; dashboard JSON tuple identity excludes the
    nullable lesson ID and does not rely on unit/type alone, completion logic
    and null-ID completed rendering unchanged, no data/API change; assessment
    keys are question/option-text occurrence identities with duplicates
    retained, order/prefixes/marking/scoring/payload unchanged,
    AdaptiveQuizCard untouched. Limit recorded: full-tuple uniqueness for two
    identical dashboard slots not proven by tests; backend evidence says
    identical tuples are the same lesson slot. No browser/backend/Sonar claim.
  - BatchD part1 muucyzcg-h-9wvs active: new
    src/lib/document-occurrences.ts immutable document-occurrence keys
    assigned from authored structure before filtering, inline parser segments
    keyed by source offset/range (never word text), native-help/rules/
    examples/mistakes by section plus occurrence ordinal; no persistent
    content IDs, no data schema change. Meaningful RED for duplicate authored
    lines/cells/words keeping identity under filter changes. Remaining S6479
    sites (phrasebook, vocabulary detail, lesson, progress, pricing, tour,
    landing faq) follow in later batches.
  - BatchD part1 muucyzcg-h-9wvs replaced all 14 grammar-detail index
    sites with pure occurrence/range keys; value+repetition ordinal for
    authored arrays, original start/end offsets for inline segments, never
    displayed position or word text; ranges assigned before blank/cell
    filtering. Baseline7/7, RED missing module then 2 keys versus3 expected,
    GREEN11/11 with typecheck/lint/format clean. Honest notes: DOM continuity
    already passed with index keys so that is equivalence evidence, and the
    detail page has no category/topic filter so continuity is proven on the
    occurrence records directly. One intermediate existing toggle test needed
    an explicit topic-settlement readiness barrier. Independent verifier
    muuddfyb-i-f1pq running; no browser/full-suite/Sonar claim.
  - Independent verifier muuddfyb-i-f1pq accepted D part1: 11/11 plus
    typecheck/lint/format; occurrence keys are pure and deterministic from
    section path plus serialized authored value plus same-value repetition
    ordinal, never displayed index; inline keys use original split-segment
    start/end offsets and keep empty boundary spans distinct; ranges assigned
    before blank/cell filtering; parsing output, escaping, rule numbering,
    related-topic slug keys and native-help lifecycle unchanged; the new topic
    readiness wait adds synchronization without relaxing existing assertions.
    Limits: regex range correctness depends on the capturing split retaining
    delimiters (outside verified usage); escaping is source-inspected; no
    browser/full-suite/Sonar claim.
- [ ] C7: Semantic HTML/accessibility — S6819, 5
- [ ] C8: Readability and complexity — S3358/S3776/S6660/S7721, 144
- [ ] Final local quality gate, relevant browser regressions and Sonar scan

Counts are disjoint and sum393; explanatory categories, not official Sonar
classification. The test category is54, not the arithmetic42 error in the raw
retrieval handoff.

## Acceptance and checks

Applicable deterministic behaviour changes: observed RED before implementation,
GREEN after, then focused regression. Type/import substitutions preserving
behaviour: no fabricated RED, baseline/post equivalence and typecheck.
Per batch focused tests/typecheck/lint/format. Per category record commands,
results, rollback paths, full source scope and commit identity. Native assessment
and available review follow current provider continuations; never reset old
review authority without explicit maintenance authorization. Unassessable or
unavailable review requires independent verification.

Stable React keys require actual domain identity; never substitute random keys.
Component extraction must preserve state identity and effect lifetimes.
Semantic HTML migrations must preserve focus, keyboard, modal lifecycle and
visual tokens, verified in browser where applicable. Removing act wrappers must
not conceal missing awaited updates. Complexity refactors preserve business
behaviour, not merely metric scores.

Final gate: pnpm quality:local, relevant existing Playwright regressions,
Sonar scan of final revision and unresolved MAINTAINABILITY query. Report failed
server gate conditions separately and prove analyzed revision where available.
Do not assert zero without usable API data. Remote/publishing remains excluded.

## Progress

Mapper mush1iz6-1h-w5on verified393 unique open findings, category counts
unchanged. C1 has13 source files:16 straightforward type/import findings and
four deprecated audio capture findings in VoiceRecorder. Installed React types
19.3.0 provide React.SubmitEvent<HTMLFormElement>; preserve submit contracts.
Audio migration is not mechanical: ScriptProcessorNode/createScriptProcessor
must be replaced with real nondeprecated capture architecture and runtime
acceptance, no suppressions. C1 remains one commit; internal batches uncommitted.

C1 batch A: bounded type/import writer, baseline/post focused tests and static
checks. C1 batch B: read-only recorder migration mapping derives exact worklet
asset/source/test paths and loading/bundling/cleanup contract before writer.
Recorder mapper mushb30e-1j-myiu recommends exact surfaces:
VoiceRecorder.tsx, public/audio/voice-recorder.worklet.js,
tests/components/VoiceRecorder.test.tsx,
tests/lib/voice-recorder-worklet.test.ts, tests/e2e/voice-recorder.spec.ts.
No package/CSP/Vite/encoder/caller changes initially. Public same-origin worklet
matches existing public/vad asset convention; production URL/CSP acceptance
must be tested, not assumed. Worklet copies mono PCM, silent output, native
sample rate, FIFO sample messages and stopped acknowledgement before cleanup
and existing16kHz WAV upload. Preserve recording-start plan/callback snapshots;
no language field invented. Unsupported/error paths have no deprecated fallback.

User selected stop acknowledgement timeout3seconds (ack_timeout_3000).
After missing acknowledgement, cleanup/error and no upload of potentially
truncated audio. Do not launch recorder writer while batchA writer is active. Runtime acceptance needs native AudioWorklet with fake microphone,
mock-only STT, valid16kHz mono WAV/plan and stop/cleanup/CSP assertions.

BatchA writer musha760-1i-fks6 completed:16 mapped findings across12source
files,11React submit annotations and2duplicate import groups;14insertions/
16deletions. Baseline/post193tests across12files passed, typecheck/lint/
Prettier/whitespace clean. Forgot-password lacks dedicated suite; no source
runtime behaviour changed. Uncommitted until all C1 passes.

BatchB writer musizp90-1k-zp4b completed five mapped surfaces: native
AudioWorklet, session-local resources, copied mono PCM/silent output,
FIFO stopped ACK before cleanup/upload, user-approved3000ms timeout with no
truncated upload on failure. Initialization/unmount cancellation releases
immediately; stop waits for ACK. Preserve native capture rate,16kHz encoding
and recording-start plan/callback snapshots.

Observed RED23failed/28passed; final GREEN53/53 across recorder/processor/audio
suites. Typecheck/lint/final format/whitespace passed (initial unused test mock
parameter corrected). Playwright --list collected8 entries; mobile intentionally
skipped, no browser run by writer. C1 was uncommitted at this intermediate handoff; final commit evidence is
recorded above.

ASSESS unassessable due undeclared untracked files, outcome unknown; independent
verification required. Verifier musjlble-1l-8jrp now runs focused53tests,
typecheck/lint and desktop native AudioWorklet fake-microphone production/CSP
acceptance. No category complete or native/server approval claim yet.

Verifier musjlble-1l-8jrp returned browser4/4 failures: manual/autostop waited
for responses, cancellation/module-failure context-close counters remained0.
It reports getUserMedia rejection before AudioContext/worklet creation, but
claims missing launch flags without providing exact actual arguments/error.
No native capture/CSP acceptance established. Do not globally change browser
launch configuration on this unproven premise. Read-only incident mapper
musju06r-1m-2b2v inspects traces, option precedence, permission policy and exact
microphone failure to derive the narrowest correction. C1 remains incomplete
and uncommitted; no blind full-suite retry.

Incident mapper musju06r-1m-2b2v confirmed root cause unproven: Playwright1.63
supports file-scope launchOptions, traces include microphone permission and
same-origin policy, but no actual launch args/getUserMedia exception/secure
context readings. Earlier global-flag recommendation rejected. Previous logs
support focused53tests/typecheck/lint completed; browser no acceptance.

Bounded test-only diagnostics writer musk29ji-1n-3jv8 captures native
getUserMedia outcomes (calling original/rethrowing), secure context, permission
and policy; attachments no raw audio/secrets. No production/config changes.
After checks, one DEBUG=pw:browser manual-stop scenario is authorized as
necessary runtime diagnosis under existing build/artifact scope; no full rerun
until evidence identifies the failure.

Diagnostic writer musk29ji-1n-3jv8 completed only the E2E spec: capped native
getUserMedia/addModule observation, original args/receivers/results/rejections
preserved; window.recorderDiagnostics and teardown JSON attachment contain
secureContext/API/permission/policy and exact errors, no deviceIDs/raw audio.
Typecheck/lint/format passed; --list8 entries collected. Targeted verifier
musk786h-1o-zzmq now runs only desktop manual-stop with DEBUG=pw:browser once
and inspects actual launch flags plus attached diagnostics.
That command exited1 with No tests found: anchored grep selected nothing;
no browser launched and no afterEach diagnostics exist. This is selection
failure, not recorder/capture evidence. Bounded verifier muskb4ih-1p-uijm
first runs unanchored grep with --list and requires exactly one desktop test,
then executes that verified selection once with DEBUG. No source/config edits
or blind retry. C1 remains uncommitted, native acceptance still unavailable.

Verifier muskb4ih-1p-uijm selected exactly1 then ran once. Native
getUserMedia/addModule called and resolved, secureContext/API availability true,
micpermission granted/policy allowed, fake-device flags present, CSP violations
empty; cleanup1context/1track. First failure was worklet page.waitForResponse
30s timeout: expected network event absent despite native module resolution.
Manualstop/WAV/delivery not reached. No capture defect/flag failure established.
Bounded spec-only correction muskg4fd-1q-1oem records actual module URL,
observes original native addModule completion and separately checks static asset
serving via HTTP; retains actual samples/WAV/exactonce checks. No API mocks or
production/config changes; browser run follows corrected harness validation.

Observation correction muskg4fd-1q-1oem completed test-only: actual module
pathname/same-origin validated, original addModule completion awaited with
bounded polling, separate HTTP asset status/type/body/CSP check. Static checks
passed and desktop --list collected4scenarios. Manual/autostop/cancel waiters
corrected; modulefailure/WAV/exactonce contracts retained. Independent verifier
muskljnh-1r-e2g0 now runs focused53tests/typecheck/lint and all4desktop scenarios
once against corrected harness. Run completed: focused53/53/typecheck/lint
passed; browser2passed/2failed. Manualstop native module/CSP/PCM mono16kWAV
plan42/STT/reviewexactonce and cleanup passed; cancellation mode switch
cleanup/no STT/review passed (not navigation during active capture).
Autostop review poll5000ms equals production5s capture so deadline excludes
ACK/resample/upload margin; failure does not establish source bug. Modulefail
page route abort did not reject native addModule (resolved), so fault not
injected and cleanup not exercised. NoC1commit/fullacceptance.

Bounded spec-only correction muskrzq8-1s-8rg3 addresses justified full autostop
budget without fake clocks and native module rejection mechanism (prefer original
addModule on intentionally invalid sameorigin URL in failure scenario, explicitly
label synthetic fault injection). Healthy native observation remains unchanged;
no production/config/3000ms policy changes or relaxed exactonce/WAV criteria.

Correction muskrzq8-1s-8rg3 completed test-only: autostop budget15000ms
(real5s capture+up to3sACK+7s delivery margin), native timestamp verifies no
upload before5s from module resolution. Failure-only nonexistent sameorigin
URL calls original addModule and must actually reject (no promise fabrication),
with error/cleanup/zeroSTTreview assertions. Typecheck/lint/format/list4desktop
passed after diagnostic typing corrections. Final independent verifier
muskzu6s-1t-5cj1 now runs focused53/static/all4desktop once. No browser GREEN
claimed by writer. Final verifier muskzu6s-1t-5cj1 returned PASS53/53,
static checks and4/4desktop, all scenario assertions reached. Actual native
loader fault and real-clockautostop timing verified; no screenshots retained.
Nonfatal build warnings and absent playwright-report listing are not test
failures. C1 functional acceptance complete; server/native approval separate.
