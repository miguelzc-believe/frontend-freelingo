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
- [ ] C2: Modern JavaScript/TypeScript APIs — S6606/S6582/S7755/S7770/S7776/S7765/S4138/S7780, 18 — implementation in progress
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
- [ ] C3: Error messages and stringification — S7722/S6551, 15
- [ ] C4: React component/props contracts — S6759/S6478/S6767, 89
- [ ] C5: Test structure and conventions — S8980/S5906/S5976/S8782/S1607/S9332, 54
- [ ] C6: List identity and DOM attributes — S6479/S7761, 48
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
