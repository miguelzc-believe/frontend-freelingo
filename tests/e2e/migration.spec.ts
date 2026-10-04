import { test, expect, type Page } from '@playwright/test'

type RouteCase = {
  path: string
  destination: string
  ready: (page: Page) => Promise<void>
}

const visibleText = (text: string) => async (page: Page) => {
  await expect(page.getByText(text, { exact: true })).toBeVisible()
}

const enabledButton = (name: string | RegExp) => async (page: Page) => {
  const button = page.getByRole('button', { name, exact: true })
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
}

const retryState =
  (message: string, retry = 'Retry') =>
  async (page: Page) => {
    await visibleText(message)(page)
    await enabledButton(retry)(page)
  }

const fixtureNotFound = async (page: Page) => {
  await expect(
    page.getByRole('heading', { name: 'Page not found', exact: true })
  ).toBeVisible()
  const dashboard = page.getByRole('link', {
    name: 'Go to dashboard',
    exact: true,
  })
  await expect(dashboard).toBeVisible()
  await expect(dashboard).toHaveAttribute('href', '/dashboard')
  const home = page.getByRole('link', { name: 'Home', exact: true })
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute('href', '/')
}

// These settled states match the existing HTTP fixture (including its 404s).
const migratedRoutes: readonly RouteCase[] = [
  { path: '/login', destination: '/login', ready: enabledButton('Sign in') },
  {
    path: '/register',
    destination: '/register',
    ready: enabledButton('Create account'),
  },
  {
    path: '/forgot-password',
    destination: '/forgot-password',
    ready: enabledButton('Send reset link'),
  },
  {
    path: '/reset-password',
    destination: '/reset-password',
    ready: visibleText(
      'Invalid reset link. Please request a new password reset.'
    ),
  },
  {
    path: '/verify-email',
    destination: '/verify-email',
    ready: visibleText(
      'Invalid or expired verification link. Please request a new one from your account.'
    ),
  },
  {
    path: '/onboarding',
    destination: '/onboarding',
    ready: enabledButton('en-GB British English'),
  },
  {
    path: '/billing/success',
    destination: '/billing/success',
    ready: async (page) => {
      // Five confirmation requests have four real 1.5s intervals between them.
      await expect(
        page.getByRole('heading', {
          name: 'Your subscription is being confirmed',
          exact: true,
        })
      ).toBeVisible({ timeout: 15000 })
    },
  },
  {
    path: '/billing/canceled',
    destination: '/billing/canceled',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'No charge was made', exact: true })
      ).toBeVisible()
    },
  },
  {
    path: '/terms',
    destination: '/terms',
    ready: visibleText('1. About FreeLingo'),
  },
  {
    path: '/privacy',
    destination: '/privacy',
    ready: visibleText('1. Overview'),
  },
  {
    path: '/dashboard',
    destination: '/dashboard',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', {
          name: 'Your plan, at your pace',
          exact: true,
        })
      ).toBeVisible()
    },
  },
  {
    path: '/assessment',
    destination: '/assessment',
    ready: enabledButton(/I am a complete beginner/),
  },
  {
    path: '/assessment/level-test',
    destination: '/assessment/level-test',
    ready: async (page) => {
      const dialog = page.getByRole('alertdialog', {
        name: 'Before you begin',
        exact: true,
      })
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: 'Start', exact: true })
      ).toBeVisible()
    },
  },
  {
    path: '/chat',
    destination: '/chat',
    ready: async (page) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await page.getByTitle('Show chats', { exact: true }).click()
      }
      const sidebar = page.locator('aside').filter({
        has: page.getByRole('button', { name: 'Retry', exact: true }),
      })
      await expect(sidebar.getByText('Error', { exact: true })).toBeVisible()
      await expect(
        sidebar.getByRole('button', { name: 'Retry', exact: true })
      ).toBeEnabled()
    },
  },
  {
    path: '/conversation',
    destination: '/conversation',
    ready: enabledButton('Start Session'),
  },
  {
    path: '/faq',
    destination: '/faq',
    ready: enabledButton(/^Where do I start\?/),
  },
  {
    path: '/feedback',
    destination: '/feedback',
    ready: visibleText('✕ Failed to load. Please try again.'),
  },
  {
    path: '/flashcards',
    destination: '/flashcards',
    ready: visibleText('No cards due for review'),
  },
  {
    path: '/flashcards/vocabulary',
    destination: '/flashcards/vocabulary',
    ready: visibleText(
      'No saved words yet. Select a word while reading to save it here.'
    ),
  },
  {
    path: '/grammar',
    destination: '/grammar',
    ready: async (page) => {
      // Non-OK grammar responses resolve to []; this renders only after loading.
      await visibleText('Grammar Reference')(page)
      await visibleText('No topics found.')(page)
    },
  },
  {
    path: '/grammar/fixture',
    destination: '/grammar/fixture',
    // Non-OK topics resolve to []; the missing slug calls notFound().
    ready: fixtureNotFound,
  },
  {
    path: '/lesson/1',
    destination: '/lesson/1',
    ready: retryState(
      'An unexpected error occurred. You can try again or go back to the dashboard.',
      'Try again'
    ),
  },
  {
    path: '/listening',
    destination: '/listening',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'Listening', exact: true })
      ).toBeVisible()
      // A non-OK /next response settles idle; only a thrown fetch sets error.
      await visibleText('No exercises available for your level.')(page)
      await enabledButton('Generate exercise')(page)
    },
  },
  {
    path: '/phrasebook',
    destination: '/phrasebook',
    // Non-OK categories resolve to []; empty results render after loading.
    ready: visibleText('No phrases match your filters'),
  },
  {
    path: '/plan',
    destination: '/assessment',
    ready: enabledButton(/I am a complete beginner/),
  },
  {
    path: '/progress',
    destination: '/progress',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', {
          name: 'Create your study plan',
          exact: true,
        })
      ).toBeVisible()
      await enabledButton('Take assessment first')(page)
    },
  },
  {
    path: '/reading',
    destination: '/reading',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'Reading', exact: true })
      ).toBeVisible()
      // A non-OK /next response settles idle; only a thrown fetch sets error.
      await visibleText('No exercises available for your level.')(page)
      await enabledButton('Generate exercise')(page)
    },
  },
  {
    path: '/settings',
    destination: '/settings',
    ready: async (page) => {
      await visibleText('Profile and access')(page)
      await expect(page.locator('input[type="email"]')).toHaveValue(
        'learner@example.invalid'
      )
    },
  },
  {
    path: '/settings/languages',
    destination: '/settings/languages',
    ready: visibleText('Active'),
  },
  {
    path: '/settings/memories',
    destination: '/settings/memories',
    ready: retryState('Memories could not be loaded.'),
  },
  {
    path: '/vocabulary',
    destination: '/vocabulary',
    ready: visibleText('No vocabulary sets match your search'),
  },
  {
    path: '/vocabulary/fixture',
    destination: '/vocabulary/fixture',
    // A non-OK detail leaves vocabSet null after loading and calls notFound().
    ready: fixtureNotFound,
  },
  {
    path: '/admin',
    destination: '/admin',
    ready: visibleText('Failed to load admin metrics.'),
  },
  {
    path: '/admin/feedback',
    destination: '/admin/feedback',
    ready: visibleText('Failed to load. Please try again.'),
  },
  {
    path: '/admin/reviews',
    destination: '/admin/reviews',
    ready: visibleText('Failed to load reviews.'),
  },
  {
    path: '/admin/system',
    destination: '/admin/system',
    ready: visibleText('Failed to load the dashboard announcement.'),
  },
  {
    path: '/admin/users',
    destination: '/admin/users',
    ready: visibleText('Failed to load users'),
  },
  {
    path: '/admin/users/1',
    destination: '/admin/users/1',
    ready: visibleText('Failed to load user data'),
  },
]

test('SSR landing preserves identity, navigation and local fonts', async ({
  page,
  request,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Content Security Policy')
    )
      errors.push(message.text().slice(0, 200))
  })
  const response = await request.get('/')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('What did you do yesterday?')
  expect(response.headers()['cross-origin-embedder-policy']).toBe(
    'credentialless'
  )
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() =>
    localStorage.setItem('fl_cookie_consent', 'accepted')
  )
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.evaluate(() => document.fonts.check('16px "Geist Variable"'))
  ).toBe(true)
  await expect(
    page.getByRole('link', { name: 'Start', exact: true }).first()
  ).toHaveAttribute('href', '/register')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  for (const section of await page.locator('.reveal').all()) {
    await section.scrollIntoViewIfNeeded()
    await expect(section).toHaveClass(/reveal-visible/)
  }
  await page.locator('h1').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('landing.png'),
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Start', exact: true }).first().click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.locator('form')).toBeVisible()
  expect(errors).toEqual([])
})

test('direct links retain invitations, UI locale and unknown-route behavior', async ({
  page,
  context,
  request,
}) => {
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'es', domain: '127.0.0.1', path: '/' },
  ])
  await page.goto('/register?invite=fixture&plan=monthly')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  const terms = page.locator('a[href*="/terms"]').first()
  await expect(terms).toHaveAttribute('href', /invite=fixture/)
  await terms.click()
  await expect(page).toHaveURL(/\/terms\?/)
  expect(new URL(page.url()).searchParams.get('invite')).toBe('fixture')
  const missing = await request.get('/dashboard-unknown')
  expect(missing.status()).toBe(404)
  const guarded = await request.get('/dashboard', { maxRedirects: 0 })
  expect(guarded.status()).toBe(307)
  expect(guarded.headers().location).toBe('/login')
})

test('browser session restores the authenticated shell and keeps theme preference', async ({
  page,
  context,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Content Security Policy')
    )
      errors.push(message.text().slice(0, 200))
  })
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'browser-fixture',
      httpOnly: true,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.addInitScript(() => {
    localStorage.setItem(
      'fl-theme',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    )
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
  })
  await page.goto('/dashboard')
  await expect(page.locator('a[href="/plan"]').first()).toBeAttached()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('body')).toContainText('Test Learner')
  await page.screenshot({
    path: info.outputPath('dashboard.png'),
    fullPage: true,
  })
  await page.reload()
  await expect(page.locator('body')).toContainText('Test Learner')
  expect(errors).toEqual([])
})

test('production proxies preserve incremental SSE and binary audio', async ({
  request,
}) => {
  const response = await request.post('/api/chat', { data: {} })
  expect(response.headers()['content-type']).toContain('text/event-stream')
  expect(response.headers()['x-accel-buffering']).toBe('no')
  expect(await response.text()).toContain('first')
  const audio = await request.post('/api/tts', { data: { text: 'fixture' } })
  expect(audio.headers()['content-type']).toBe('audio/mpeg')
  expect(await audio.body()).toEqual(Buffer.from([0, 255, 10]))
  const model = await request.get('/vad/silero_vad_v5.onnx')
  expect(model.status()).toBe(200)
  expect(model.headers()['cross-origin-opener-policy']).toBe('same-origin')
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.headers()['content-type']).toContain(
    'application/manifest+json'
  )
  expect((await manifest.json()).name).toBe('FreeLingo')
  expect(await (await request.get('/robots.txt')).text()).toContain(
    'Disallow: /admin'
  )
  expect(await (await request.get('/sitemap.xml')).text()).toContain(
    'https://freelingo.app/terms'
  )
})

test('login and logout preserve the httpOnly session cookie', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
  })
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('body')).toContainText('Test Learner')
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'refresh_token')
      ?.httpOnly
  ).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'refresh_token'
  )
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Logout', exact: true }).last().click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Logout', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login$/)
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'refresh_token')
  ).toBe(false)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('all migrated route families render without framework errors', async ({
  page,
  context,
}) => {
  test.setTimeout(120000)
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'browser-fixture',
      httpOnly: true,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.addInitScript(() => localStorage.setItem('fl_tour_done', '1'))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Content Security Policy')
    )
      errors.push(message.text().slice(0, 200))
  })
  expect(migratedRoutes).toHaveLength(38)
  for (const { path, destination, ready } of migratedRoutes) {
    await test.step(path, async () => {
      // The vocabulary empty state exists before fetching: observe the request
      // before navigation so that initial empty DOM cannot satisfy readiness.
      const vocabularyResponse =
        path === '/vocabulary'
          ? page.waitForResponse((response) => {
              const url = new URL(response.url())
              return (
                url.pathname === '/api/vocabulary' &&
                url.searchParams.get('language') === 'en-GB'
              )
            })
          : undefined
      await page.goto(path)
      if (vocabularyResponse) {
        const response = await vocabularyResponse
        expect(response.status()).toBe(404)
        await response.finished()
      }
      await expect(page).toHaveURL((url) => url.pathname === destination)
      await ready(page)
      await expect(
        page.getByRole('heading', { name: 'Something went wrong', exact: true })
      ).toHaveCount(0)
      if (path === '/settings/memories')
        await expect(
          page.getByRole('heading', { name: 'Memory', exact: true }).first()
        ).toBeVisible()
      if (path === '/settings/languages')
        await expect(page.locator('a[href="/settings"]').last()).toBeVisible()
    })
  }
  expect(errors).toEqual([])
})
