# FreeLingo frontend

Independent migration of the FreeLingo web client from Next.js to TanStack Start. It preserves the current interface, URL paths, fifteen UI locales and FastAPI contracts. The original frontend and deployment remain unchanged.

Source: FreeLingo local `development`, commit `aebc472e1f1598f7dddaafa174047162c6c395d4`. Original project and attribution: https://github.com/artcc/freelingo, Arturo Carretero Calvo. The original GPL license is retained in `LICENSE`.

## Run

Use Node 25 for parity with CI and the Dockerfile; Node 24.21 or newer is also supported. The package manager is pinned to pnpm 12.5.1 in `packageManager`. Use pnpm exclusively for project commands.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The app listens on `http://127.0.0.1:3000`. Set `BACKEND_URL` to your existing FastAPI service; no backend, database or external AI provider is started by this repository. Voice messages use the same-origin `/api/conversation/*` HTTP transport.

```sh
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm start
```

`pnpm start` runs the compiled Node/Nitro server. Supply environment variables to the production process; `.env` is loaded by the development/build tooling, not automatically by the production server.

For browser acceptance against an isolated HTTP fixture:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser tests start a fixture backend on port 3199 and build/start the production frontend on port 3102. Both ports must be free. They exercise desktop and mobile Chromium, not Android devices or real speech providers.

## Configuration and boundaries

- `BACKEND_URL`: private FastAPI upstream; default `http://127.0.0.1:8000`. Use `http://backend:8000` on the deployment network.
- `PUBLIC_API_URL`: no longer used. Voice messages use the same-origin API proxy rather than a direct browser connection to FastAPI.
- `UMAMI_SCRIPT_URL`: private configured analytics upstream URL.
- `PUBLIC_UMAMI_WEBSITE_ID`: public analytics identifier.
- `HOST` and `PORT`: production server bind address and port; container defaults are `0.0.0.0:3000`.

TTS and STT use independent global OmniRoute configurations in **Settings → AI**
under the chat model. Enter the OmniRoute OpenAI-compatible base URL and the full
audio route model ID, with a write-only key for each service. TTS also includes
voice and speed and can play a short test sample. STT tests connectivity using
generated silence; it does not retain or upload a learner recording. Neither
service falls back to speech environment variables or local Kokoro/Whisper.
Missing TTS disables generated speech, missing STT disables microphone input,
and voice conversations require both plus the LLM. Existing audio/history stays
readable. See the [backend voice configuration guide](../backend-freelingo/docs/operations.md#voice-settings-omniroute).

Only the explicit public values, UI locale and translation catalog enter the root loader's browser payload. Never put service keys in public configuration.

All `/api/*` requests stay on the frontend origin and are streamed to FastAPI with authorization, cookies, cancellation and upstream statuses. The browser stores the access token only in Zustand memory; FastAPI owns the rotating httpOnly refresh cookie and authorization. Navigation guards are presentation aids.

`deploy/nginx.conf` is an example for integration into an existing TLS deployment. It routes HTTP through Start and disables buffering for SSE. Conversation no longer requires WebSocket forwarding. Docker and reverse-proxy configuration are prepared artifacts; their deployment acceptance belongs to the maintainer.

## Global AI configuration

An administrator configures the instance-wide AI provider, model, optional base
URL and write-only API key in **Settings → AI** (`/settings#ai`). Regular users
see only the provider and model. A fresh instance has no AI configuration, and
AI learning features remain unavailable until an administrator saves one.
Testing uses the current draft without saving and may cost a small number of
tokens. Keys stay in component-local memory while editing and are encrypted by
FastAPI; they are never public frontend configuration or browser persistence.
See [the AI settings guide](docs/ai-settings.md) for provider requirements,
Docker-host Ollama URLs, key retention, API contracts and validation boundaries.

## Structure

- `src/routes`: native typed TanStack route definitions and server routes.
- `src/app`: migrated domain screens and layouts; directory names do not imply a framework dependency.
- `src/server`: same-origin transport, request locale, public-data cache and allowlisted runtime configuration.
- `src/components`, `src/data`, `src/hooks`, `src/lib`, `src/store`, `src/types`: preserved domain/UI organization.
- `messages` and `public`: repository-owned translations and assets. There are no imports or symlinks to the monorepo.

Public pages render on the server. The authenticated app renders on the client and restores session state before exposing its screens. Voice-message recording is lazy-loaded inside the client-only boundary. Public configuration is cached for one hour and landing reviews for five minutes; user sessions and locale are never shared in that cache. Intl formatting uses UTC to keep server/client output deterministic.

The visual system retains Tailwind 4, shadcn/Base UI, Lucide, the `fl-*` tokens, both themes, locally hosted Geist fonts and the CJK font families. Existing built URL links use small native TanStack navigation adapters; route definitions, parameters and search fields are generated/typed by TanStack Router.

`strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are required. ESLint prohibits explicit `any` in authored source and tests. `src/routeTree.gen.ts` is generated by TanStack and follows the generator's own types; never edit it manually.

Explicit recording uses the repository-owned AudioWorklet in `public/audio/voice-recorder.worklet.js`; there are no VAD models or ONNX/WASM voice dependencies. Tap Record and then Stop and send. Every voice message has play/pause and a progress bar, and tutor replies autoplay with a manual-play fallback. Two transcription retries reuse the same recording. Audio is session-only; ending the session releases browser audio and deletes temporary backend audio, while transcripts remain in history. See [voice messages](docs/voice-messages.md).

## SonarQube quality analysis

Run `pnpm quality` to execute lint, type checking, dead-code checks, tests with
V8 coverage and CRAP, then upload to the private
[FreeLingo Frontend project](https://sonar.miguel-zapata.com/dashboard?id=frontend-freelingo).
The command stops on a failed local check, waits for the server Quality Gate,
and returns a nonzero exit code if the gate fails. It requires network access;
the scanner downloads its runtime on the first run.

Use `pnpm quality:local` for the checks without upload. Mutation testing is
manual: run `pnpm test:mutation:core` for critical code or `pnpm test:mutation`
for all application code. Neither SonarQube analysis nor pushes/PRs run Stryker.
See [the quality guide](docs/quality.md) for commands, thresholds, compatibility
and measured results. SonarQube measures code duplication during each upload.

The command requires `SONAR_TOKEN`, `SONAR_HOST_URL` and `SONAR_PROJECT_KEY`
in its inherited environment. Load the local `.envrc` with direnv before running
`pnpm quality`; the runner does not load credential files or `.envrc` itself.
Missing or blank variables stop execution before any checks or upload.
Keep `.envrc` outside Git. In CI, supply `SONAR_TOKEN` from a secret store and
the host/project settings from repository variables.

Coverage is generated fresh at `coverage/lcov.info` and imported by SonarQube.
`pnpm test:coverage` generates it without uploading. Only the generated
`src/routeTree.gen.ts` is excluded from source analysis and coverage;
application code without tests remains in the coverage denominator.
Sources are `src` and `scripts`; tests are classified separately under `tests`.
Scanner output and coverage are ignored by Git. The quality gate and rule
profiles are managed in SonarQube; this command does not change them.

This Community Build project has one analysis branch, `development`. Running
the command from a task branch updates that same dashboard with the local
checkout; it does not create a separate branch or PR analysis. E2E, build and
real device/provider acceptance remain the separate checks described above.

The initial integration was validated on 2026-09-30 with Node 24.21.0 and pnpm 12.5.1: `pnpm quality`
completed successfully (lint, typecheck, 70 test files / 692 tests, fresh LCOV
import and remote analysis). The missing-credential regression test also proves
that no checks or upload run without a token. Vitest line coverage was 49.04%;
SonarQube reported 48.0% combined coverage, 50.3% line coverage and 5.6%
duplication. Its baseline recorded 21 bugs, 4 vulnerabilities and 404 code
smells; these are findings to review, not fixes included in this integration.
The initial `Sonar way` gate returned `OK` with no evaluated conditions because
this first analysis establishes the new-code baseline. A passing initial gate
does not mean the existing code has no findings. Dependency analysis was
skipped by the scanner; this command does not establish dependency security.

To remove this integration, remove `scripts/quality.ts`,
`sonar-project.properties`, the `quality` and `test:coverage` scripts, the scanner
and coverage dependencies, and the Vitest coverage configuration. Revoke the
project token and remove its local environment configuration independently. Runtime app behavior is
unaffected.

## Delivery

The repository uses local `development` as its integration branch. Work happens on task branches with tests and documentation kept together. Publishing, switching infrastructure and retiring Next.js are separate authorized actions.

See `docs/migration.md` for route parity, verification evidence and outstanding environment acceptance.
