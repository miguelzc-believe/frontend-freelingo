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
