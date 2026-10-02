# Changelog

## Unreleased

- Share refresh-cookie rotation across session restoration, API retries, avatars, subscription checks and billing. Development remounts no longer race to renew the same cookie and unexpectedly log users out.
- Make the listening audio seek bar operable with the keyboard, associate the admin announcement checkbox with its label explicitly, and pass image alternative text through explicitly.

## 0.1.0

- Migrate the complete FreeLingo web interface to an independent TanStack Start frontend.
- Adopt pnpm with a pinned manager and reproducible lockfile.
- Enforce reinforced strict TypeScript and preserve FastAPI authentication, learning and speech contracts.
- Retain the existing visual identity, fifteen UI locales and URL routes.
