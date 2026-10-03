import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Validate JSON at the Node boundary rather than importing locale JSON directly.
const messages: unknown = JSON.parse(
  readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8')
)
function message(namespace: string, key: string): string {
  if (!messages || typeof messages !== 'object' || !(namespace in messages))
    throw new Error('Missing fixture message namespace')
  const group: unknown = Reflect.get(messages, namespace)
  if (!group || typeof group !== 'object' || !(key in group))
    throw new Error('Missing fixture message key')
  const value: unknown = Reflect.get(group, key)
  if (typeof value !== 'string') throw new Error('Invalid fixture message')
  return value
}
const invalidMessage = message('lesson', 'invalidExplanation')
const retryLabel = message('common', 'retry')
const title = 'A1 fixture: everyday greetings'
const question = 'Choose the everyday greeting.'
const targetText = 'Use hello to greet someone.'
const nativeText = 'Usa hello para saludar.'
// Synthetic disclosure canary only: never real user text, credentials or audio.
const canary = 'SYNTHETIC_PRIVATE_EXPLANATION_CANARY'

async function readableAlert(page: Page, alert: Locator) {
  await expect(alert).toHaveText(invalidMessage)
  await alert.scrollIntoViewIfNeeded()
  await expect(alert).toBeVisible()
  const box = await alert.boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('Alert has no geometry')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Missing browser viewport')
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  const style = await alert.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      fontSize: parseFloat(computed.fontSize),
      opacity: computed.opacity,
      color: computed.color,
      overflow: element.scrollWidth > element.clientWidth,
    }
  })
  expect(style.fontSize).toBeGreaterThanOrEqual(12)
  expect(style.opacity).toBe('1')
  expect(style.color).not.toBe('rgba(0, 0, 0, 0)')
  expect(style.overflow).toBe(false)
}

async function noDisclosure(page: Page) {
  await expect(page.locator('body')).not.toContainText(canary)
  await expect(page.locator('body')).not.toContainText('[object Object]')
}

async function lessonFixture(
  page: Page,
  content: Record<string, unknown>,
  generation: 'malformed' | 'http-error' = 'malformed'
) {
  const unexpected: string[] = []
  let generations = 0
  // The existing mock backend owns auth/config/languages. These lesson-related
  // requests are same-origin browser interception, including every lesson write.
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const origin = new URL(page.url()).origin
    const path = url.pathname
    const method = request.method()
    if (
      !path.startsWith('/api/lessons') &&
      !path.startsWith('/api/study-plan') &&
      !path.startsWith('/api/grammar')
    ) {
      // Never forward unexpected writes to even the mock backend.
      if (method === 'GET' || path === '/api/auth/refresh') {
        await route.continue()
        return
      }
    } else if (url.origin === origin) {
      if (method === 'GET' && path === '/api/lessons/1') {
        await route.fulfill({
          json: {
            lesson: {
              id: 1,
              study_plan_id: 1,
              title,
              lesson_type: 'grammar',
              cefr_level: 'A1',
              is_completed: false,
              content,
            },
            exercises: [
              {
                id: 11,
                exercise_type: 'multiple_choice',
                question,
                options: ['Hello', 'Goodbye'],
                correct_answer: 'Hello',
                explanation: null,
                native_explanation: null,
                native_hint: null,
                user_answer: null,
                score: null,
                feedback: null,
                corrections: null,
              },
            ],
          },
        })
        return
      }
      if (method === 'POST' && path === '/api/lessons/1/native-explanation') {
        generations++
        await route.fulfill({
          status: generations === 1 && generation === 'http-error' ? 503 : 200,
          json:
            generations === 1
              ? { native_explanation: { text: { private: canary } } }
              : { native_explanation: { text: nativeText } },
        })
        return
      }
      if (method === 'GET' && path === '/api/study-plan/today') {
        await route.fulfill({
          json: { lessons: [], progress_day: 1, plan_id: 1, cefr_level: 'A1' },
        })
        return
      }
      if (
        method === 'GET' &&
        path === '/api/grammar' &&
        url.searchParams.get('language') === 'en-GB'
      ) {
        await route.fulfill({ json: { topics: [] } })
        return
      }
    }
    unexpected.push(`${method} ${path}`)
    await route.abort('blockedbyclient')
  })
  return { unexpected, generations: () => generations }
}

async function exerciseStillWorks(page: Page) {
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByText(question, { exact: true })).toBeVisible()
  const choice = page.getByRole('button', { name: 'Hello', exact: true })
  await choice.focus()
  await expect(choice).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(choice).toBeFocused()
  await expect(
    page.getByRole('button', {
      name: message('lesson', 'submitAnswer'),
      exact: true,
    })
  ).toBeEnabled()
  await noDisclosure(page)
}

test.beforeEach(async ({ page, context }) => {
  // Same httpOnly fixture session used by the existing migration browser tests.
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
  })
})

for (const fixture of [
  { name: 'target container', content: { explanation: [canary] } },
  {
    name: 'target text object',
    content: { explanation: { text: { private: canary } } },
  },
  {
    name: 'native text object',
    content: {
      explanation: { text: targetText },
      native_explanation: { text: { private: canary } },
    },
  },
]) {
  test(`${fixture.name}: safe readable alert preserves lesson controls`, async ({
    page,
  }) => {
    const requests = await lessonFixture(page, fixture.content)
    await page.goto('/lesson/1')
    await expect(page.getByRole('alert')).toHaveCount(1)
    await readableAlert(page, page.getByRole('alert'))
    if (fixture.name === 'native text object') {
      await expect(page.getByText(targetText, { exact: true })).toBeVisible()
      await expect(
        page.getByRole('button', { name: retryLabel, exact: true })
      ).toBeEnabled()
    }
    await exerciseStillWorks(page)
    const exit = page.getByRole('button', {
      name: message('lesson', 'exit'),
      exact: true,
    })
    await exit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(exit).toBeFocused()
    expect(requests.generations()).toBe(0)
    expect(requests.unexpected).toEqual([])
  })
}

for (const failure of ['malformed', 'http-error'] as const) {
  test(`native generation ${failure}: keyboard retry recovers without stale alert`, async ({
    page,
  }) => {
    const requests = await lessonFixture(
      page,
      {
        explanation: { text: targetText },
        native_explanation: { text: { private: canary } },
      },
      failure
    )
    await page.goto('/lesson/1')
    await readableAlert(page, page.getByRole('alert'))
    const retry = page.getByRole('button', { name: retryLabel, exact: true })
    await retry.click()
    await expect.poll(requests.generations).toBe(1)
    await expect(retry).toBeEnabled()
    await readableAlert(page, page.getByRole('alert'))
    await noDisclosure(page)
    await retry.focus()
    await expect(retry).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText(nativeText, { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(retry).toHaveCount(0)
    await expect(page.getByText(targetText, { exact: true })).toBeVisible()
    await exerciseStillWorks(page)
    expect(requests.generations()).toBe(2)
    expect(requests.unexpected).toEqual([])
  })
}

test('string invitation survives real register to terms navigation', async ({
  page,
}) => {
  // URL strings exercise browser navigation only, not typed number/boolean serialization.
  const invite = 'fixture space+plus&equals=value'
  const query = new URLSearchParams({ invite, plan: 'monthly' })
  await page.goto(`/register?${query}`)
  const terms = page.locator('a[href*="/terms"]').first()
  await expect(terms).toBeVisible()
  await terms.focus()
  await expect(terms).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/terms\?/)
  const destination = new URL(page.url())
  expect(destination.pathname).toBe('/terms')
  expect(destination.searchParams.get('invite')).toBe(invite)
})
