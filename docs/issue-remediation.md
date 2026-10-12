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
