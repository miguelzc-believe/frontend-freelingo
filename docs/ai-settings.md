# Global AI settings

Chat, text-to-speech (TTS) and speech-to-text (STT) use independent instance-wide
configurations saved by an administrator at `/settings#ai`. They are not
per-user preferences and are not set through frontend/provider environment
variables. A fresh instance has no AI or speech configuration. Missing chat
configuration blocks AI learning features; missing TTS/STT respectively disables
voice playback/microphone input, and voice conversations require all three.
Static material, history and previously saved media remain available.

## Configure

1. Sign in as an administrator and open **Settings → AI**.
2. Choose Ollama, OpenAI, Anthropic, DeepSeek, or a custom OpenAI-compatible service.
3. Enter the model identifier supported by that service.
4. Leave the base URL empty for a known provider's server default, or enter an
   HTTP(S) URL. Custom providers require a URL. URLs may not contain credentials,
   a query string, or a fragment. A trailing `/v1` is preserved; the backend adds
   it for Ollama when needed. For Ollama on the Docker host, use
   `http://host.docker.internal:11434`, not container-local `localhost`. Hostname
   resolution and service reachability must be configured by the deployment operator.
5. Enter an API key for OpenAI, Anthropic or DeepSeek. Keys are optional for
   Ollama and custom services. Anthropic also exposes an optional positive
   maximum output-token count (server default: 8192).
6. **Test connection** sends the draft for a bounded small generation. It does
   not save, and may incur a small provider token charge.
7. **Save changes** applies the global configuration immediately.

## OmniRoute voice (TTS and STT)

In the same **Settings → AI** page, configure separate Text to speech and Speech
to text panels. Both use the OpenAI-compatible OmniRoute API:

- Base URL: `https://omniroute.miguel-zapata.com/v1` (or the corresponding URL
  for your own OmniRoute deployment).
- TTS model: full routed audio model ID, e.g. `openai/gpt-4o-mini-tts`.
- STT model: full routed audio model ID, e.g. `openai/whisper-1` or
  `groq/whisper-large-v3-turbo`.
- Enter the API key required by the OmniRoute instance **separately in each
  panel**. It may be the same key if that key is authorized for both routes.
- TTS also needs the provider voice name and speed; the default voice is `alloy`.

The route model IDs must be available and have their upstream provider
credentials/connections configured in OmniRoute; depending on the enabled
connections, `openai/tts-1` or `openrouter/deepgram/nova-3` may be available, but
these IDs must be verified against the instance's configured audio providers.
The local FreeLingo API key alone cannot grant access to a disabled audio
provider. **Test TTS** makes a
short synthetic preview and plays it in the browser; **Test STT** sends a
generated one-second silent WAV and discards the returned transcript. Neither
test saves the draft or uploads learner audio. Both may incur provider charges.
Speech settings live in separate PostgreSQL rows from the chat LLM, are encrypted
with service-specific credential keys derived from `SECRET_KEY`, and are applied
without restarting the backend. These speech forms currently support OmniRoute's
OpenAI-compatible `/audio/speech` and `/audio/transcriptions` routes.

Regular users can view only configured status, provider and model, and are told
to contact their administrator. The authenticated layout displays a prominent
missing-configuration notice linking to `/settings#ai`.

## Credential handling

API keys are write-only and encrypted on the backend. The saved key is never
returned, displayed, logged, or placed in localStorage, Zustand, root-loader
configuration, or URL parameters. An admin sees only the `has_api_key` hint.
The new key is held in component-local memory while editing; leaving the screen
or a canonical successful save clears it. Failed saves/tests keep the draft.
Changing provider or normalized base URL clears a typed key and disables reuse
of the saved key, even if the administrator subsequently returns to the original
identity. A fresh key is then required for key-mandatory providers. For optional
keys, the request explicitly clears the old key when needed.

The safe status is reloaded on save and window focus, using uncached requests
and last-request-wins handling. No credential state is shared with the banner.
Backend authorization remains authoritative; hiding the admin form is not a
security boundary. Errors shown by this UI are fixed localized messages, not
upstream response bodies or exception messages.

### Local backend integration

An isolated production frontend + FastAPI + PostgreSQL browser check on 6 October 2026 validated real login, testing a custom-provider draft, saving encrypted/write-only credentials, reloading canonical settings, and absence of keys in browser storage. Its local deterministic HTTP provider returned short generation responses; this is integration evidence, not acceptance of an external commercial LLM or real speech service. The disposable stack/database were removed without changing the operator's configuration.

## API contracts

- `GET /api/llm-settings/status` (authenticated): `configured`, `provider`, `model`.
- `GET /api/admin/llm-settings` (admin): safe metadata, including `base_url`,
  `has_api_key`, `max_tokens`, and `revision` — never the key itself.
- `PUT /api/admin/llm-settings` (admin): save a draft and return canonical metadata.
- `POST /api/admin/llm-settings/test` (admin): test a draft without saving; `{ok:true}`
  on success. The UI handles validation (422), forbidden (403), test failure (502),
  timeout (504), and network errors without displaying provider details.

Use `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, and `pnpm build` for local
validation. API and component tests cover privilege separation, key handling,
canonical reload/persistence, errors, draft testing, and status refresh. Browser
fixtures are not evidence that a real external AI provider works; live provider
and deployment acceptance must be performed independently by the operator.

### Original LLM-settings acceptance (6 October 2026, before TTS/STT settings)

Validated with Node 24.16.0 and pnpm 12.5.1 after `pnpm install --frozen-lockfile`:

- `pnpm lint` and `pnpm typecheck` passed.
- Targeted API, UI, status lifecycle, FAQ, translation and settings integration
  checks passed (6 test files, 63 tests after the provider-destination reset follow-up).
- Focused coverage for the four new AI settings modules passed (49 tests):
  100% lines/functions, 97.35% statements, 94.15% branches. This is focused
  feature coverage, not a replacement for full-repository coverage.
- `pnpm build` passed, with existing Vite/Rolldown dependency warnings.
- `pnpm test:e2e tests/e2e/ai-settings.spec.ts` passed all 4 tests in desktop and
  mobile Chromium against deterministic HTTP fixtures. This includes keyboard
  focus visibility, responsive overflow, global save/reload, password masking,
  no key persistence, status-banner refresh, test failure drafts and regular-user
  privilege separation.
- Both dead-code commands completed against the existing reviewed legacy budget;
  their reported unused files/exports are outside the AI settings implementation.

The default full-suite run at that time passed 123 files / 1323 tests but the existing
`tests/scripts/quality-gates.test.ts` CRAP subprocess test exceeded its 5-second
limit on this host. The isolated CRAP test passed with `--testTimeout=15000`.
A full run with that timeout passed 123 files / 1324 tests but encountered two
unrelated async fixture races in `admin-system-banner.test.tsx` and
`lesson-word-tooltip.test.tsx`; both passed on isolated rerun (8 tests). These
reruns were environment checks, not changes to the committed test configuration. The voice-settings follow-up has separate final validation documented after its integration.
