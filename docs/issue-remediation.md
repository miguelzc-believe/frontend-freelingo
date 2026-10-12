# Sonar issue remediation by category

## Scope and acceptance

The read-only inventory on 2026-10-12 contains 51 open issues, not 52:
seven test findings, two utility findings, seven typing/export findings,
18 accessibility findings, 13 nested-ternary findings and four cognitive
complexity findings. Work is split into one local commit per category.

Preserve backend authorization, memory-only credentials/audio, language scope,
`en-GB`, URLs, themes, `fl-*` tokens and existing interaction contracts. No rule
suppressions, weakened assertions, gate changes or artificial caption tracks.
Only a final remote analysis is authorized; local checks do not prove remote
closure. No push or deployment is authorized.

## 1. Test stability and assertions

Initial lesson responses are deferred and resolved under asynchronous `act`;
RTL `render` is no longer wrapped. This flushes the external update and initial
answer/selection effects before synthetic input. Legitimate `act` calls for
manual promise settlement and playback remain. Storage and playback assertions
use specific matchers without weakening their contracts.

The first repetition batch exposed the same initial-answer race in an unchanged
completion-rejection case. The controlled-load helper now also protects initial
answer-entry scenarios in that file, rather than increasing timeouts or retrying
input. Production lesson code is unchanged.

Validation: 66 focused tests passed; after the harness adjustment all 39 lesson
cases passed in ten consecutive fresh processes (five normal two-worker runs,
five serial runs). Focused ESLint and strict typecheck passed. Full-suite results
and final remote analysis are recorded below when actually completed.

## 2. Linear normalization and binary audio integrity

Base URL normalization uses a suffix index and one slice, preserving trim-then-
remove-final-slashes semantics without regex backtracking. Base64 audio uses
`codePointAt` only under the binary-string invariant of `atob` (bytes 0–255,
no surrogate pairs, in-bounds index); it is not recoded as UTF-8.

Validation: 44 utility/voice settings tests passed, including 100,000-slash
suffix and nonfinal-run cases, and exact Blob bytes `[0, 127, 128, 255]` with
MIME preservation. Scoped ESLint, formatting and diff checks passed. The binary
fixture is synthetic and does not establish audible/device/provider acceptance.

## 3. Readonly props, submit events and direct re-exports

Voice component props are readonly without freezing state or changing keyed
account remounts. AI form submission uses React's `SubmitEvent`, supported by the
installed types, rather than deprecated `FormEvent`. Shared URL helpers are
re-exported directly; the locally used error constructor retains its identity.

Validation: 36 AI/voice component and API tests passed, including helper/error
identity and a cancelable form submit that saves once without testing the draft.
Strict typecheck and scoped ESLint passed. Dependencies and API payloads are
unchanged.

## 4. Native status semantics and audio text alternatives

Status messages use native `output` elements, preserving block display and
existing tokens. Interactive retry/settings controls remain outside the
announcing region; structural containers are not converted to invalid output
content. Alerts keep their urgent semantics.

Audio and its keyboard controls reference the actual visible transcript with
`aria-describedby`. IDs are unique per mounted conversation. Pending/failed STT
placeholders are never described as transcripts. The same DOM node retains the
target-language attributes and is updated when transcription is confirmed.

S4084 remains a technical-review item, not a claimed caption fix. The current
contract has no alignment timings. WCAG 2.2 criterion 1.2.1 permits an equivalent
text alternative for audio-only; criterion 1.2.2 addresses synchronized media.
That distinction does not prove that every generated/failed-STT sample is fully
accessible or that Sonar's syntactic track requirement is satisfied. No empty
track, fabricated timing, suppression or server issue-state change is used.
True synchronized captions require actual alignment and a visible caption UI,
with private session-bound resources and device/browser validation.

References: [WCAG audio-only](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html)
and [MDN audio accessibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio#accessibility).

Validation: 59 conversation/player/API tests passed, including real transcript
relations, exclusion of processing text, `en-GB` attributes and native error
status semantics. Scoped ESLint and strict typecheck passed. Reader/device
acceptance and synchronized-caption accuracy have not been tested.
AI/voice status component tests passed 35 cases. Production-build Chromium E2E
passed all 18 desktop/mobile cases after correcting the result selector to the
existing full localized copy. The first run passed 16/18: its two failures were
that selector, not a production change. The earlier full Vitest suite passed
1,575 tests in 138 files; its first invocation had an external 120-second command
limit and the completed rerun used a sufficient process limit without changing
test timeouts. Existing bundler warnings remain non-fatal.

## 5. Explicit presentation branches

Nested ternaries are replaced with named presentation decisions and early
returns, not moved to another expression. Voice labels preserve recording first,
then connection/send, ended and ready. Quota presentation keeps complete freemium
values ahead of server quota, including zero remaining/limit and trial mode;
incomplete freemium values fall back to general non-trial quota.

Validation: 62 focused voice tests passed, including all six status labels with
and without recording and an eight-case quota matrix. Settings status and
provider-label branches retain their existing localized content, tokens,
request ownership and hooks. All 69 settings/presentation cases passed, including
provider option order and values, eight banner combinations, readonly refresh
errors and TTS/STT retries. New asynchronous tests settle external promises, not
`act`-wrapped renders. Scoped ESLint and strict typecheck passed.

## 6. Focused responsibilities and cognitive complexity

Message presentation is a stable top-level component keyed by the existing entry
ID. Playback remains owned by the mounted conversation; callbacks consult the
current run at interaction time, and session tokens/controllers/maps never enter
presentation props. Transcription retry presentation is separate from transport
recovery. The parent still owns scope invalidation, capture, deadlines and cleanup.

Result application delegates to user confirmation, idempotent assistant text
insertion and awaited audio loading. Nullish/empty text, authoritative attempts,
CEFR, memory announcement ordering, audio error classification and post-await
run checks are retained. Deduplicated text does not skip audio recovery. Voice
settings split test execution and sanitized error selection without changing
saved-key rules, busy lifetime or independent TTS/STT requests.

Validation so far: 79 message/conversation/player/voice-settings cases passed,
including eight sanitized error combinations and STT-failure transcript recovery.
The new error-matrix test initially selected the heading's inner wrapper rather
than its section; the selector was corrected without changing production logic.
Seven API/recording/i18n files passed 142 cases. Final local gates, browser checks
and the remote inventory below remain the acceptance evidence, not an assumed
cognitive-complexity score.

AI form markup is a stable top-level component with readonly presentation props;
requests, draft validation and submission stay with the admin owner. Its 34
component tests passed. The temporary pnpm-dlx SonarJS 4.2.2 rule preflight found
no cognitive-complexity-over-15 or nested-conditional findings in the five
changed target components. It added no repository dependency or configuration;
this local preflight is not a substitute for the server analysis.

## Final local validation

`pnpm quality:local` passed lint, strict types, both unchanged dead-code budgets,
all 1,630 tests in 141 files and CRAP. Fresh V8 coverage: 91.00% lines, 84.62%
branches, 89.13% statements and 86.62% functions. CRAP measured 1,942 functions,
eight above 30 and a maximum of 56.00. Existing unused-code findings remain
visible; no budgets or source exclusions were relaxed. Runtime was Node 25.9.0
and pnpm 12.5.1; this is not a claim of Node 24/device/deployment acceptance.
The mechanical UI detector found no findings on the eight changed components.
Production-build Chromium E2E passed all 76 cases (desktop and mobile emulation),
including the complete route sweep, settings/keyboard flows, native AudioWorklet,
private audio and lifecycle regressions. Build succeeded with the existing
non-fatal Vite/Rolldown warnings. Two independent code reviews found no blockers.
These checks do not validate physical devices, live FastAPI/providers or screen
reader announcements. S4084 is explicitly pending the agreed technical review.
Interactive production-fixture checks also measured zero horizontal overflow at
1440px and 390px and no links inside status outputs. Screenshots were captured
under `/tmp/opencode`, but this model cannot inspect image input, so no visual
screenshot acceptance is claimed. The minimal interactive fixture logged four
unhandled optional dashboard request errors; the full deterministic E2E suite
above is the regression evidence, not a claim of a clean live-provider console.

## Final remote analysis

The single authorized scan analyzed clean revision
`e51d1904b65e7741bfa293740872732c075a6fbc`, with fresh LCOV. Compute task
`d433c621-4f45-4932-9c74-060d21bebe22` completed successfully on 2026-10-12;
analysis ID `35fc2451-c8ab-4564-a2a0-82c4a766ce41`.

Read-only enumeration confirmed **one open issue**, the original S4084 in
`src/components/conversation/MessageAudioPlayer.tsx`: **50 of 51 issues closed**,
with no new findings. Zero bugs, vulnerabilities and security hotspots. Overall
combined coverage is 88.5%, new coverage 92.2% and new duplication 0.08568%.
Global duplication remains 0.6%: 214 duplicated lines / 34,172 lines, six blocks.
The actual revision-bound `pnpm quality:duplication` command passed.

The server Quality Gate remains **ERROR solely for that one issue**; coverage
and duplication pass. The scanner's nonzero exit reports this genuine gate
failure, not a failed compute task. No issue was accepted/resolved manually, no
rules or thresholds changed and no second scan published. This measurement is
bound to the revision above; the subsequent final-commit amendment records only
this documentation/result notice, with no source/test/configuration change.
