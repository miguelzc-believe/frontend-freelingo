import { expect, test as base, type Locator, type Page } from '@playwright/test'
import {
  adminFixture,
  adminUser,
  browserFixture,
  nativeAssertions,
  nativeFixture,
  nativeLanguageCodes,
  passage,
  practiceFixture,
  transcript,
  type BrowserFixture,
} from './fixtures/duplication'

const test = base.extend<{ http: BrowserFixture }>({
  http: async ({ page }, use) => {
    const fixture = await browserFixture(page)
    await use(fixture)
    expect(
      fixture.unexpected,
      'Only explicitly fixture-backed requests'
    ).toEqual([])
    expect(
      fixture.runtimeErrors,
      'No JS, React, CSP or console errors'
    ).toEqual([])
  },
})

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'browser-fixture',
      httpOnly: true,
      domain: '127.0.0.1',
      path: '/',
    },
    { name: 'NEXT_LOCALE', value: 'en', domain: '127.0.0.1', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
    localStorage.setItem(
      'freelingo:reviewPromptDismissed',
      JSON.stringify({ count: 3, lastDismissedAt: 0 })
    )
  })
})

async function noHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement
        const main = document.querySelector('main')
        return {
          document: root.scrollWidth > root.clientWidth + 1,
          main: main ? main.scrollWidth > main.clientWidth + 1 : false,
        }
      })
    )
    .toEqual({ document: false, main: false })
  await expect(page.locator('body')).not.toContainText('[object Object]')
}

async function targetText(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toHaveAttribute('lang', 'en-GB')
  await expect(locator).toHaveClass(/\bfont-target-latin\b/)
}

async function answerQuestions(page: Page, secondAnswer: 'A' | 'B') {
  const submit = page.getByRole('button', {
    name: 'Submit answers',
    exact: true,
  })
  await expect(submit).toBeDisabled()
  const first = page.getByRole('button', {
    name: 'A. To the library',
    exact: true,
  })
  await targetText(first.getByText('To the library', { exact: true }))
  await first.focus()
  await page.keyboard.press('Enter')
  await expect(first).toBeFocused()
  await expect(first).toHaveClass(/border-fl-accent/)
  await expect(submit).toBeDisabled()
  await page
    .getByRole('button', {
      name: secondAnswer === 'A' ? 'A. A cookbook' : 'B. A travel guide',
      exact: true,
    })
    .click()
  await expect(submit).toBeEnabled()
  await submit.click()
}

for (const modality of ['reading', 'listening'] as const) {
  test(`${modality}: submit reviews correct and incorrect answers, then history replay resets answers without XP`, async ({
    page,
    http,
  }) => {
    const fixture = practiceFixture(http, modality)
    await page.goto(`/${modality}`)
    await expect(
      page.getByRole('heading', {
        name: modality === 'reading' ? 'Reading' : 'Listening',
        exact: true,
      })
    ).toBeVisible()
    if (modality === 'reading') {
      await targetText(page.getByText(passage, { exact: true }))
    } else {
      await expect(page.getByText(transcript, { exact: true })).toHaveCount(0)
      await expect(page.getByText('Transcript', { exact: true })).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Play', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('slider', { name: 'Seek', exact: true })
      ).toBeVisible()
    }
    await noHorizontalOverflow(page)
    await answerQuestions(page, 'A')
    await expect(page.getByText('Results', { exact: true })).toBeVisible()
    await expect(page.getByText('1/2', { exact: true })).toBeVisible()
    await expect(page.getByText('+12', { exact: true })).toBeVisible()
    await expect(page.getByText('Answer review', { exact: true })).toBeVisible()
    expect(fixture.attempts).toEqual([
      {
        exercise_id: fixture.exercise.id,
        answers: { '0': 'A', '1': 'A' },
        replay: false,
      },
    ])

    const correctQuestion = page.getByText('1. Where does Maya go?', {
      exact: true,
    })
    const incorrectQuestion = page.getByText('2. What does Maya borrow?', {
      exact: true,
    })
    await targetText(correctQuestion)
    await targetText(incorrectQuestion)
    await expect(correctQuestion.locator('..')).toHaveClass(
      /border-fl-success\/50/
    )
    await expect(incorrectQuestion.locator('..')).toHaveClass(
      /border-fl-error-fg\/50/
    )
    const correctOption = page.getByText('A travel guide', { exact: true })
    const wrongOption = page.getByText('A cookbook', { exact: true })
    await targetText(correctOption)
    await expect(correctOption.locator('..')).toHaveClass(/text-fl-success/)
    await expect(wrongOption.locator('..')).toHaveClass(
      /text-fl-error-fg.*line-through/
    )
    if (modality === 'listening') {
      await expect(page.getByText('Transcript', { exact: true })).toBeVisible()
      await targetText(page.getByText(transcript, { exact: true }))
    }
    await noHorizontalOverflow(page)

    await page.getByRole('button', { name: 'History', exact: true }).click()
    await expect(
      page.getByRole('heading', {
        name: modality === 'reading' ? 'Reading history' : 'Listening history',
        exact: true,
      })
    ).toBeVisible()
    const replay = page.getByRole('button', {
      name: 'Practice again',
      exact: true,
    })
    await expect(replay).toBeVisible()
    expect(fixture.historyQueries).toEqual(['?skip=0&limit=10'])
    await expect(page.getByText('1/2', { exact: true })).toBeVisible()
    await expect(page.getByText('+12 XP', { exact: true })).toBeVisible()
    await targetText(
      page.getByText(modality === 'reading' ? passage : transcript, {
        exact: true,
      })
    )
    await noHorizontalOverflow(page)
    await replay.click()
    if (modality === 'listening') {
      await expect(page.getByText(transcript, { exact: true })).toHaveCount(0)
      await expect(page.getByText('Transcript', { exact: true })).toHaveCount(0)
    }
    await answerQuestions(page, 'B')
    await expect(page.getByText('2/2', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Replay (no XP)', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('+0', { exact: true })).toHaveCount(0)
    await expect(page.getByText('+12', { exact: true })).toHaveCount(0)
    expect(fixture.attempts).toEqual([
      {
        exercise_id: fixture.exercise.id,
        answers: { '0': 'A', '1': 'A' },
        replay: false,
      },
      {
        exercise_id: fixture.exercise.id,
        answers: { '0': 'A', '1': 'B' },
        replay: true,
      },
    ])
    await expect(
      page.getByText('A cookbook', { exact: true }).locator('..')
    ).not.toHaveClass(/line-through/)
    await noHorizontalOverflow(page)
  })
}

test('grammar, vocabulary and phrasebook native help preserves loading, retry, duplicate entries and cached disclosure state', async ({
  page,
  http,
}) => {
  const scenarios = nativeFixture(http)
  for (const scenario of scenarios) {
    await test.step(scenario.kind, async () => {
      try {
        await page.goto(scenario.path)
        const disclosure = page.getByRole('button', {
          name: /^Help in Spanish/,
        })
        await expect(disclosure).toHaveAttribute(
          'aria-expanded',
          String(scenario.initiallyOpen)
        )
        const panel = disclosure.locator('..')
        if (scenario.autoLoad) {
          await expect.poll(() => scenario.languages.length).toBe(1)
        } else {
          expect(scenario.languages).toEqual([])
          if (!scenario.initiallyOpen) await disclosure.click()
          await panel
            .getByRole('button', { name: 'Show help in Spanish', exact: true })
            .click()
          if (scenario.failsFirst) {
            const retry = panel.getByRole('button', {
              name: 'Retry',
              exact: true,
            })
            await expect(retry).toBeVisible()
            expect(scenario.languages).toEqual(['en-GB'])
            await expect(
              panel.getByText(scenario.summary, { exact: true })
            ).toHaveCount(0)
            await retry.focus()
            await page.keyboard.press('Enter')
          }
        }
        await expect(
          panel.getByText('Preparing help in Spanish...', { exact: true })
        ).toBeVisible()
        await expect(
          panel.getByRole('button', { name: 'Retry', exact: true })
        ).toHaveCount(0)
        await noHorizontalOverflow(page)
        scenario.release()
        await expect(
          panel.getByText(scenario.summary, { exact: true })
        ).toBeVisible()
        await expect(
          panel.getByText('Preparing help in Spanish...', { exact: true })
        ).toHaveCount(0)
        await expect(
          panel
            .getByRole('listitem')
            .filter({ hasText: nativeAssertions.repeatedTip })
        ).toHaveCount(2)
        await expect(
          panel.getByText(nativeAssertions.trap.mistake, { exact: true })
        ).toHaveCount(2)
        await expect(
          panel.getByText(nativeAssertions.trap.fix, { exact: true })
        ).toHaveCount(2)
        const glossary = panel
          .getByText('Mini glossary', { exact: true })
          .locator('..')
        const terms = glossary.getByText(nativeAssertions.glossary.term, {
          exact: true,
        })
        await expect(terms).toHaveCount(2)
        await targetText(terms.first())
        await targetText(
          page.getByText(scenario.target, { exact: true }).first()
        )
        const expectedRequests = scenario.failsFirst ? 2 : 1
        expect(scenario.languages).toEqual(
          Array<string>(expectedRequests).fill('en-GB')
        )
        await disclosure.click()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
        await expect(
          panel.getByText(scenario.summary, { exact: true })
        ).toHaveCount(0)
        await disclosure.click()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
        await expect(
          panel.getByText(scenario.summary, { exact: true })
        ).toBeVisible()
        expect(scenario.languages).toHaveLength(expectedRequests)
        await noHorizontalOverflow(page)
      } finally {
        scenario.release()
      }
    })
  }
})

test('register password toggles are independent and legal navigation preserves encoded invite before login toggling', async ({
  page,
  http,
}) => {
  const authWrites: string[] = []
  for (const path of ['/api/auth/register', '/api/auth/login']) {
    http.handle('POST', path, async (route) => {
      authWrites.push(path)
      await route.fulfill({ json: { detail: 'unexpected_auth_submit' } })
    })
  }
  const invite = 'fixture space+plus&equals=value'
  const query = new URLSearchParams({ invite, plan: 'monthly' })
  await page.goto(`/register?${query}`)
  const fields = page
    .locator('form input[spellcheck="false"]')
    .filter({ visible: true })
  // Register has email first, then the two independently controlled passwords.
  const password = fields.nth(1)
  const confirmation = fields.nth(2)
  // These synthetic values are never submitted or used as account credentials.
  await password.fill('synthetic-password')
  await confirmation.fill('synthetic-confirmation')
  await expect(password).toHaveAttribute('type', 'password')
  await expect(confirmation).toHaveAttribute('type', 'password')
  await page
    .getByRole('button', { name: 'Show password', exact: true })
    .first()
    .click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(confirmation).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(confirmation).toHaveAttribute('type', 'text')
  await page
    .getByRole('button', { name: 'Hide password', exact: true })
    .first()
    .click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(confirmation).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await expect(confirmation).toHaveAttribute('type', 'password')
  await expect(password).toHaveValue('synthetic-password')
  await expect(confirmation).toHaveValue('synthetic-confirmation')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(
    page.getByText('Passwords do not match', { exact: true })
  ).toHaveCount(0)
  await expect(page.locator('select')).toHaveValue('es')
  expect(
    await page
      .locator('select option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).sort()
      )
  ).toEqual([...nativeLanguageCodes].sort())
  await noHorizontalOverflow(page)

  for (const document of ['terms', 'privacy'] as const) {
    const link = page.getByRole('link', {
      name: document === 'terms' ? 'Terms of Service' : 'Privacy Policy',
      exact: true,
    })
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/${document}` &&
        url.searchParams.get('from') === 'register' &&
        url.searchParams.get('invite') === invite
    )
    await expect(
      page.getByText(
        document === 'terms' ? '1. About FreeLingo' : '1. Overview',
        { exact: true }
      )
    ).toBeVisible()
    await noHorizontalOverflow(page)
  }
  await page
    .getByRole('link', { name: 'Back to Register', exact: true })
    .click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/register' && url.searchParams.get('invite') === invite
  )
  await expect(
    page.getByRole('button', { name: 'Show password', exact: true })
  ).toHaveCount(2)
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  const loginPassword = page.locator('[autocomplete="current-password"]')
  await loginPassword.fill('synthetic-login')
  await expect(loginPassword).toHaveAttribute('type', 'password')
  const show = page.getByRole('button', { name: 'Show password', exact: true })
  await show.focus()
  await page.keyboard.press('Enter')
  await expect(loginPassword).toHaveAttribute('type', 'text')
  const hide = page.getByRole('button', { name: 'Hide password', exact: true })
  await expect(hide).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(loginPassword).toHaveAttribute('type', 'password')
  await expect(loginPassword).toHaveValue('synthetic-login')
  await expect(
    page.getByText('Please enter your email', { exact: true })
  ).toHaveCount(0)
  expect(authWrites).toEqual([])
  await noHorizontalOverflow(page)
})

test('admin subscription badge remains consistent across responsive list and detail with native catalog defaults', async ({
  page,
  http,
}) => {
  adminFixture(http)
  await page.goto('/admin/users')
  const main = page.getByRole('main')
  const badges = main.locator('span').filter({ hasText: /^Paused$/ })
  await expect(badges).toHaveCount(2)
  const desktopBadge = badges.first()
  const mobileBadge = badges.last()
  for (const badge of [desktopBadge, mobileBadge]) {
    await expect(badge).toHaveClass(/border-yellow-500\/40/)
    await expect(badge).toHaveClass(/text-yellow-400/)
  }
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024
  await expect(desktop ? desktopBadge : mobileBadge).toBeVisible()
  await expect(desktop ? mobileBadge : desktopBadge).not.toBeVisible()
  await expect(desktopBadge).not.toHaveClass(/inline-flex/)
  await expect(mobileBadge).toHaveClass(/inline-flex/)
  await noHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Create User', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const native = dialog
    .locator('label')
    .filter({ has: page.getByText('Native Language', { exact: true }) })
    .locator('select')
  const target = dialog
    .locator('label')
    .filter({ has: page.getByText('Language to learn', { exact: true }) })
    .locator('select')
  await expect(native).toHaveValue('es')
  await expect(target).toHaveValue('en-GB')
  expect(
    await native
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).sort()
      )
  ).toEqual([...nativeLanguageCodes].sort())
  // The mock backend advertises en-GB and es; only catalog-supported target
  // variants appear, not the profile-only native code es.
  await expect(target.locator('option')).toHaveCount(1)
  await expect(target.locator('option')).toHaveAttribute('value', 'en-GB')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  const detailLink = main.locator(
    `a[href="/admin/users/${adminUser.id}"]:visible`
  )
  await detailLink.click()
  await expect(page).toHaveURL(new RegExp(`/admin/users/${adminUser.id}$`))
  const detailBadge = page
    .getByRole('main')
    .locator('span')
    .filter({ hasText: /^Paused$/ })
  await expect(detailBadge).toBeVisible()
  await expect(detailBadge).toHaveClass(/border-yellow-500\/40/)
  await expect(detailBadge).toHaveClass(/text-yellow-400/)
  await expect(detailBadge).not.toHaveClass(/inline-flex/)
  await noHorizontalOverflow(page)
})
