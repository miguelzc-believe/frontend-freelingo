# Migration acceptance

## Compatibility

All 39 original page routes are represented by native TanStack routes, including the public landing, account recovery, onboarding, billing returns, legal pages, learning domains, settings and administrative pages. The app and legal shells preserve their previous layout boundaries. Public navigation, query parameters and dynamic resource identifiers keep their existing URLs.

UI locale cookies remain `NEXT_LOCALE` and `LOCALE_DETECTED` for compatibility. Locale choice, onboarding, invitation propagation, the en-GB target-language default, language-owned progress and frontend-only visibility rules retain the existing contracts.

The new frontend replaces framework-specific navigation, metadata, font/image helpers, locale resolution and transport handlers. Authenticated pages use a client-only route boundary and never serialize access tokens through SSR. FastAPI endpoints, storage, subscriptions and speech-provider ownership do not change.

## Local evidence

Validated on 2026-09-30 with Node 24.21.0 and pnpm 12.5.1, on `feat/migrate-tanstack-start` from the independent repository's initial local `development` commit `0b63bb9`. The delivery is committed and merged into local `development`; obtain its full identity with `git rev-parse development`.

| Check                                                                                                                                                             | Result                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                                                  | Passed, including generation of the local VAD assets.                                       |
| `pnpm lint`                                                                                                                                                       | Passed, no warnings or errors.                                                              |
| `pnpm typecheck`                                                                                                                                                  | Passed with all three required strictness flags.                                            |
| `pnpm test:run`                                                                                                                                                   | 68 files and 688 tests passed.                                                              |
| `pnpm exec vitest run tests/server tests/app/vocabulary-errors.test.tsx tests/app/lesson-free-write-corrections.test.tsx tests/app/listening-generation.test.tsx` | Seven files and 20 focused transport, metadata and failure/answer tests passed.             |
| `pnpm test:e2e`                                                                                                                                                   | 11 passed, one intentional skip. This command builds and starts the production Node server. |
| `git diff --cached --check`                                                                                                                                       | Passed before delivery.                                                                     |

The browser suite checks server-rendered landing content, local fonts and CSP, native link navigation, invitation query preservation, Spanish UI locale, unknown URL 404s, unauthenticated redirects, login/logout and httpOnly cookies, session restoration and theme persistence. It checks manifest/robots/sitemap, VAD model delivery and security headers, SSE content and binary audio through the production transport. The unit transport tests separately prove incremental SSE frames before stream closure, multipart bytes and plan context, multiple refresh cookies, cancellation, upstream errors and query preservation.

Every original page URL is visited on desktop. The duplicate mobile route sweep is intentionally skipped; landing, navigation, login/logout, restoration and transport scenarios run on both desktop and mobile Chromium. Administrative routes with the normal-user fixture exercise the access gate; existing administrative component tests cover screen behavior. Browser tests use a deterministic HTTP backend fixture and production Start server; they do not establish acceptance against the deployed FastAPI service.

Visual confirmation covered dark landing and light dashboard on desktop and mobile. The original Tailwind tokens, Geist/CJK font assets, spacing, controls and responsive layout remain in place. The design detector reported no findings. Screenshots and browser traces are local generated artifacts under ignored `test-results/`; reproduce them with `pnpm test:e2e`.

The migrated native route structure uses index leaves wherever an overview has child pages, so overview screens cannot hide settings, assessment, vocabulary, grammar or administrative subroutes. The browser sweep also asserts the memory/language settings content. Lesson and vocabulary request failures retain a renderable screen instead of entering the framework error boundary. Unit mocks use stable callback identities where effects depend on them, and lesson answer tests settle the async load before typing.

The source monorepo remains on `aebc472e1f1598f7dddaafa174047162c6c395d4` without changes. No remote, infrastructure switch or deployment was performed. The Dockerfile and CI target Node 25; Docker execution and that Node version were not validated locally. The build succeeds with upstream bundler warnings about dependency `use client` directives; authored screens use native Start rendering boundaries.

## Route inventory

| Domain              | Preserved URLs                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public/account (11) | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding`, `/billing/success`, `/billing/canceled`, `/terms`, `/privacy`                                                                                                                               |
| Learning (19)       | `/dashboard`, `/assessment`, `/assessment/level-test`, `/chat`, `/conversation`, `/faq`, `/feedback`, `/flashcards`, `/flashcards/vocabulary`, `/grammar`, `/grammar/:slug`, `/lesson/:id`, `/listening`, `/phrasebook`, `/plan`, `/progress`, `/reading`, `/vocabulary`, `/vocabulary/:setId` |
| Settings (3)        | `/settings`, `/settings/languages`, `/settings/memories`                                                                                                                                                                                                                                       |
| Administration (6)  | `/admin`, `/admin/feedback`, `/admin/reviews`, `/admin/system`, `/admin/users`, `/admin/users/:id`                                                                                                                                                                                             |

## Delivery and rollback boundary

This work unit is the complete independent frontend migration, its preserved domain tests, production browser harness and deployment preparation. It includes repository-owned source, catalogs/assets, pnpm tooling, Node build/runtime, CI and integration examples. The copied source makes this initial migration larger than a normal incremental review; no pull request was created.

Rollback consists of keeping the original Next.js frontend in service and removing or reverting this sibling `repos/frontend-freelingo` repository. No backend, mobile client, original frontend file, database migration or shared deployment file must be reverted. After any future infrastructure switch, restore the original frontend image/configuration as described below.

## Maintainer acceptance

Before replacing the original frontend, verify the prepared container on the deployment network, production TLS/CSP and `/ws` routing; then exercise live login, refresh rotation, logout, email recovery, billing returns, administrative authorization and language isolation against FastAPI.

Verify microphone permission, VAD initialization, STT plan/language context, incremental chat, binary TTS, voice cancellation/barge-in and browser/device audio behavior with the real providers. No local mocked result proves physical-device or production speech acceptance.

Keep the original frontend image/configuration available for rollback until these checks pass. No original deployment files are changed by this migration.
