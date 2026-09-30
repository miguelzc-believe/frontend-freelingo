import { test, expect } from '@playwright/test'

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
}, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Route mapping is shared across viewport sizes; mobile flows are covered above.'
  )
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
  const paths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/onboarding',
    '/billing/success',
    '/billing/canceled',
    '/terms',
    '/privacy',
    '/dashboard',
    '/assessment',
    '/assessment/level-test',
    '/chat',
    '/conversation',
    '/faq',
    '/feedback',
    '/flashcards',
    '/flashcards/vocabulary',
    '/grammar',
    '/grammar/fixture',
    '/lesson/1',
    '/listening',
    '/phrasebook',
    '/plan',
    '/progress',
    '/reading',
    '/settings',
    '/settings/languages',
    '/settings/memories',
    '/vocabulary',
    '/vocabulary/fixture',
    '/admin',
    '/admin/feedback',
    '/admin/reviews',
    '/admin/system',
    '/admin/users',
    '/admin/users/1',
  ]
  for (const path of paths) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: 'Something went wrong', exact: true })
    ).toHaveCount(0)
    if (path === '/settings/memories')
      await expect(
        page.getByRole('heading', { name: 'Memory', exact: true }).first()
      ).toBeVisible()
    if (path === '/settings/languages')
      await expect(page.locator('a[href="/settings"]').last()).toBeVisible()
  }
  expect(errors).toEqual([])
})
