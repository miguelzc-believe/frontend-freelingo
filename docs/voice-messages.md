# Voice messages

Conversation is a sequence of explicit voice messages, not continuous microphone listening. There is no VAD model, silence detection, barge-in or conversation WebSocket.

## Interaction

1. **Start Session** creates an HTTP session and requests its greeting separately. Opening a chat-context or assessment-trial session with `autoStart` does the same. Neither action requests microphone permission or creates a capture AudioContext.
2. **Record** stops current playback, requests microphone permission and starts one mono AudioWorklet capture.
3. **Stop and send** flushes the worklet, releases microphone tracks, nodes, port and live AudioContext, then resamples to 16 kHz and uploads PCM16 WAV. The server's recording limit (never more than 120 seconds) also stops and sends automatically.
4. The user's local WAV is playable as soon as encoding finishes, before transcription returns. Both user and assistant messages have independent play/pause, elapsed/duration and seek controls. Only one message can play at a time.
5. A newly completed assistant message attempts playback once. Browser autoplay rejection is visible and localized; **Play** provides the explicit fallback. Text remains available even when synthesis, audio fetching or playback fails.
6. **End session** is separate from stopping a recording. Ending while recording discards that recording without upload.

The screen preserves context from chat, optional existing conversation ID, selected target language, CEFR-aware word saving, memory-save announcements, quota details, freemium/trial gates and review prompts. Backend authorization and quotas remain authoritative. Auto-start is scoped to account, language, trial and conversation: switching scope starts its own session once, while bearer-token refresh never duplicates a start or acquires a microphone. Assistant vocabulary saving retains the server session's CEFR level rather than using a stale active-plan prop, including selection after a normal session end.

## HTTP contract

`src/lib/conversation-api.ts` uses same-origin `apiFetch`, whose access token is held in memory and refresh cookie is httpOnly.

- `POST /api/conversation/sessions`: JSON `target_language`, optional `context`, `voice_trial_token`, `conversation_id`; returns the session ID, conversation ID, language/level, absolute/inactivity UTC deadlines and recording limit.
- `POST /sessions/{id}/greeting`: separate initial assistant turn.
- `POST /sessions/{id}/turns`: multipart `audio`, stable UUID `client_turn_id`, explicit `retry` (`false` initially).
- `POST /sessions/{id}/activity`: only explicit record/play, never a heartbeat or automatic assistant playback.
- `GET /sessions/{id}`: a visibility-return reconciliation read; does not extend inactivity.
- `POST /sessions/{id}/close`: independent idempotent, best-effort keepalive close.
- Turn audio URLs: authenticated, same-origin fetch to Blob with `cache: no-store`; never directly assigned as authenticated endpoint URLs to an audio element.

A provider failure is a successful HTTP response carrying `stt_failed`, `llm_failed` or `tts_failed`. Only confirmed `stt_failed` exposes **Retry transcription**: two manual retries, maximum three total attempts. The attempt count comes from backend `stt_attempts`, not a network request counter. Every retry sends the exact original Blob and UUID. There are no automatic STT retries, and LLM/TTS failures cannot trigger STT retry. Requests reserve only the busy state synchronously to prevent double-click requests.

A network/lost response, HTTP 500 or HTTP 409 `session_busy` exposes a generic manual **Retry**, sending identical bytes/UUID with `retry=false`. This recovers the backend's idempotent cached result without spending a transcription retry. Even if a confirmed STT retry's response is lost, it must first be recovered with `retry=false`; another `retry=true` is allowed only after the resulting `stt_failed` and authoritative attempt count are confirmed. HTTP 422 invalid audio is terminal for that recording, clears its pending presentation and allows a new recording without closing the session.

HTTP expiry/ownership/quota/service-gate failures use localized UI messages, not raw provider diagnostics. The absolute deadline never extends. Inactivity deadlines update monotonically from server responses; timers expire the local media scope and visibility-return reconciles suspended browser timers.

## Capture and lifetime

`src/lib/voice-recording.ts` reuses `/audio/voice-recorder.worklet.js`, without changing the study/flashcard `VoiceRecorder`. Its FIFO `stopped` acknowledgement is a flush barrier, preserving the final captured quantum. OfflineAudioContext resamples native device rates using the established recorder pattern. Capture is bounded in memory at the server limit and has a three-second stop-ack timeout.

Audio is session-only:

- No audio in localStorage, sessionStorage, IndexedDB, service worker cache or transcript storage.
- Local WAVs, fetched assistant Blobs and object URLs exist only inside the mounted conversation session.
- Every recording releases the live microphone before resampling/upload.
- End, expiry, unmount, logout, account/language/trial/context-ID switch abort pending requests, cancel capture, pause all players, detach their sources, revoke object URLs and clear retained retry Blobs.
- Plain text survives a normal end in the mounted screen; account/language scope changes clear it. Playback is unavailable after end.
- Late permission grants are immediately stopped. Late fetch/encode responses are ignored by run identity. A late start response with a known ID is closed; a truly lost response is bounded by request cancellation and server TTL, rather than inventing a client-side session identifier.

## Runtime validation (2026-10-08)

The local Compose stack was rebuilt and checked through the authenticated browser and real OmniRoute settings. A generated TTS sample (not a microphone recording) was converted to WAV and submitted to the turn endpoint: STT, LLM and assistant TTS completed, both private audio endpoints returned audio, and repeating the same turn ID returned the cached result. Closing the session returned 410 for its audio and removed its local audio directory; PostgreSQL retained the user and assistant transcripts. Synthetic test conversation/memory rows were removed afterward without resetting usage counters.

The visible conversation screen separately rendered a real tutor greeting and progress slider, autoplay reached the end, manual replay restarted playback, and End session removed audio elements while retaining text. A final private-audio check returned `private, no-store`; unauthenticated audio returned 401, concurrent session admission returned 409, and repeated close returned 200. This validates browser playback state, not audible physical speakers or physical mobile devices.

The full Chromium suite passed 60 of 62 cases. The two failures are the unchanged administrator create-user dialog `closedby=any` expectation (desktop and mobile), unrelated to voice. All eight new voice-message browser cases passed. After the transport-recovery and scoped auto-start safeguards, 22 voice-message/recorder/AI-settings browser cases passed. Native capture and private transport checks passed under the tightened production CSP without VAD/WASM allowances.

The final frontend coverage run passed 1,321 tests in 128 files (90.18% lines, 83.67% branches), using `pnpm exec vitest run --coverage --testTimeout=20000 --maxWorkers=1`, including StrictMode session/handoff regressions. Default parallel runs intermittently failed the unchanged lesson word-tooltip test, which also passed in isolation; the local CRAP subprocess test can exceed its default five-second budget on this shared host. The serial run and explicit timeout do not alter assertions or coverage thresholds. Lint, strict typecheck, frozen offline pnpm installation, both legacy-budget dead-code checks and CRAP passed. No remote analysis was published.

## Validation

Run from the frontend root using pnpm:

```sh
pnpm typecheck
pnpm test:run tests/components/ConversationMode.test.tsx tests/components/ConversationModeWordTooltip.test.tsx tests/components/MessageAudioPlayer.test.tsx tests/lib/conversation-api.test.ts tests/lib/voice-recording.test.ts tests/components/VoiceRecorder.test.tsx tests/lib/voice-recorder-worklet.test.ts
pnpm test:e2e tests/e2e/voice-messages.spec.ts
```

Unit tests exercise capture flush/ACK, real WAV headers, resampling, limit/empty/failure cleanup, cancelled permission and upload races, unchanged retry bytes/UUID, playback exclusivity, seeking, autoplay rejection, transcript selection and session cleanup. Focused follow-up checks also cover keyed auto-start across account/language/trial/conversation rerenders, no duplicate on token refresh, authoritative CEFR vocabulary saving, manual transport recovery with backend attempt counts, terminal bad audio, stale activity expiry and fatal playback cleanup. The focused component/word-tooltip/player run passes 47 tests, with strict typecheck and targeted ESLint also passing.

Browser tests use Chromium's generated microphone and native AudioWorklet under the production CSP, plus generated valid PCM16 WAV audio HTTP fixtures. They assert valid uploads, authenticated Blob transport, manual retry limits/byte identity, native capture release, automatic limit stop, object URL revocation and no WebSocket. They do not use recorded user audio or live STT/LLM/TTS providers.

Validated locally: strict typecheck, targeted ESLint, 152 relevant unit/component/i18n tests, and 16 production-build browser checks (voice messages plus unchanged study/flashcard recorder, desktop and mobile-emulated Chromium). These tests are not physical-device, Safari/iOS microphone or live-provider acceptance. Those require explicit device/runtime validation before claiming production acceptance. Run builds/browser suites serially in this shared workspace: Nitro build intermediates, Playwright artifact directories and fixture ports are not safe for concurrent runs. A unique `--output=/tmp/opencode/freelingo-voice-e2e` avoids artifact collisions.

Observed integration diagnostic: cancelling in-flight same-origin requests can emit Nitro `aborted` / `ECONNRESET` warnings in the fixture server. The capture/upload cancellation and all browser assertions pass; investigate proxy cancellation logging separately rather than treating these warnings as a provider failure.
