import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

const messages: unknown = JSON.parse(
  readFileSync(new URL('../../messages/de.json', import.meta.url), 'utf8')
)

function localizedLabel(namespace: string, key: string): string {
  if (
    typeof messages === 'object' &&
    messages !== null &&
    namespace in messages
  ) {
    const section: unknown = Reflect.get(messages, namespace)
    if (typeof section === 'object' && section !== null && key in section) {
      const label: unknown = Reflect.get(section, key)
      if (typeof label === 'string') return label
    }
  }
  throw new Error(`Missing German fixture label: ${namespace}.${key}`)
}

const labels = {
  tapToReveal: localizedLabel('flashcards', 'tapToReveal'),
  tapToHide: localizedLabel('flashcards', 'tapToHide'),
  good: localizedLabel('flashcards', 'good'),
}
const audioLabels = {
  ariaListen: localizedLabel('audioPlayer', 'ariaListen'),
  ariaStop: localizedLabel('audioPlayer', 'ariaStop'),
}
const cards = [
  {
    id: 701,
    study_plan_id: 42,
    word: '国際交流を通じて日常生活のさまざまな経験について話し合う',
    definition:
      'Sich im internationalen Austausch ausführlich über unterschiedliche Erfahrungen aus dem täglichen Leben unterhalten.',
    example_sentence:
      '国際交流を通じて日常生活のさまざまな経験について話し合うことで、お互いの文化や習慣をより深く理解できます。',
    translation:
      'Durch den internationalen Austausch lernen wir die Kultur und Gewohnheiten anderer Menschen besser kennen.',
    ease_factor: 2.5,
    interval: 0,
    repetitions: 0,
  },
  {
    id: 702,
    study_plan_id: 42,
    word: '新しい場所で出会った人々と協力して問題を解決する',
    definition:
      'Mit Menschen, denen man an einem neuen Ort begegnet, gemeinsam eine schwierige Aufgabe lösen.',
    example_sentence:
      '新しい場所で出会った人々と協力して問題を解決すると、違う考え方から多くのことを学ぶことができます。',
    translation:
      'Gemeinsames Problemlösen ermöglicht es uns, von unterschiedlichen Perspektiven zu lernen.',
    ease_factor: 2.5,
    interval: 1,
    repetitions: 1,
  },
]

// Generated deterministic PCM, not recorded user audio: mono 8 kHz, 16 bit.
function pcmWav() {
  const sampleRate = 8000
  const samples = sampleRate * 3
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(
      Math.round(800 * Math.sin((2 * Math.PI * 220 * i) / sampleRate)),
      44 + i * 2
    )
  }
  return buffer
}

async function mockFlashcards(page: Page, origin: string) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const unexpected: string[] = []
  await page.route(
    (url) =>
      url.origin === origin &&
      /^\/api\/(flashcards|languages|tts)(\/|$)/.test(url.pathname),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const path = url.pathname
      const body: unknown = request.postData() ? request.postDataJSON() : null
      calls.push({ method, path, body })
      if (method === 'GET' && path === '/api/languages' && !url.search) {
        return route.fulfill({
          json: {
            active_language: 'ja-JP',
            languages: [
              {
                target_language: 'ja-JP',
                is_active: true,
                plan: null,
                progress: null,
              },
            ],
            all_supported_languages: ['ja-JP'],
          },
        })
      }
      if (method === 'GET' && path === '/api/flashcards/due' && !url.search)
        return route.fulfill({ json: { due: cards, total: cards.length } })
      if (
        method === 'POST' &&
        path === '/api/flashcards/701/review' &&
        !url.search &&
        JSON.stringify(body) === JSON.stringify({ quality: 4 })
      )
        return route.fulfill({ json: { ok: true } })
      if (
        method === 'POST' &&
        path === '/api/tts' &&
        !url.search &&
        JSON.stringify(body) === JSON.stringify({ text: cards[0]!.word })
      )
        return route.fulfill({ contentType: 'audio/wav', body: pcmWav() })
      unexpected.push(`${method} ${path}${url.search}`)
      await route.abort('blockedbyclient')
    }
  )
  return { calls, unexpected }
}

async function tabTo(page: Page, control: Locator) {
  for (let step = 0; step < 80; step++) {
    await page.keyboard.press('Tab')
    if (await control.evaluate((element) => element === document.activeElement))
      return
  }
  await expect(control).toBeFocused()
}

async function assertActionLayout(control: Locator) {
  await control.scrollIntoViewIfNeeded()
  const result = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const header = element.parentElement!
    const label = header.children[0]!.getBoundingClientRect()
    const style = getComputedStyle(element)
    const card = header.parentElement!
    return {
      height: rect.height,
      width: rect.width,
      left: rect.left,
      right: rect.right,
      viewport: innerWidth,
      padding: Number.parseFloat(style.paddingLeft),
      overlap:
        rect.left < label.right &&
        rect.right > label.left &&
        rect.top < label.bottom &&
        rect.bottom > label.top,
      clipped:
        element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1,
      overflow: document.documentElement.scrollWidth - innerWidth,
      cardHeight: card.getBoundingClientRect().height,
      contentContained: [...card.querySelectorAll('p')].every((paragraph) => {
        const box = paragraph.getBoundingClientRect()
        const bounds = card.getBoundingClientRect()
        return (
          box.left >= bounds.left &&
          box.right <= bounds.right &&
          paragraph.scrollWidth <= paragraph.clientWidth + 1
        )
      }),
      focus: element.matches(':focus-visible'),
      outline: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
    }
  })
  expect(result.height).toBeGreaterThanOrEqual(44)
  expect(result.width).toBeGreaterThanOrEqual(44)
  expect(result.padding).toBeGreaterThanOrEqual(16)
  expect(result.left).toBeGreaterThanOrEqual(0)
  expect(result.right).toBeLessThanOrEqual(result.viewport)
  expect(result.overlap).toBe(false)
  expect(result.clipped).toBe(false)
  expect(result.overflow).toBeLessThanOrEqual(1)
  expect(result.cardHeight).toBeGreaterThanOrEqual(220)
  expect(result.contentContained).toBe(true)
  expect(result.focus).toBe(true)
  expect(result.outline).not.toBe('none')
  expect(result.outlineWidth).toBeGreaterThanOrEqual(2)
  expect(result.outlineColor).not.toBe('rgba(0, 0, 0, 0)')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
    localStorage.removeItem('tts_voice')
    localStorage.setItem(
      'fl-theme',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    )
    // Observe successful real media playback; never replace it with a fake event.
    const nativePlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = async function () {
      await nativePlay.call(this)
      const observed = window as Window & { fixturePlaybackCount?: number }
      observed.fixturePlaybackCount = (observed.fixturePlaybackCount ?? 0) + 1
    }
  })
})

test('flashcards expose independent native flip, audio and grading actions with CJK content', async ({
  page,
  baseURL,
}, info) => {
  const fixture = await mockFlashcards(page, new URL(baseURL!).origin)
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('body')).toContainText('Test Learner')
  // Existing locale cookie, not invented copy: longer German action labels.
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'de', url: baseURL! },
    { name: 'LOCALE_DETECTED', value: '1', url: baseURL! },
  ])
  await page.goto('/flashcards')
  const reveal = page.getByRole('button', {
    name: labels.tapToReveal,
    exact: true,
  })
  const hide = page.getByRole('button', { name: labels.tapToHide, exact: true })
  const good = page.getByRole('button', { name: labels.good, exact: true })
  await expect(reveal).toBeVisible()
  await expect(page.getByText(cards[0]!.word, { exact: true })).toHaveAttribute(
    'lang',
    'ja-JP'
  )
  await page.evaluate(() => document.fonts.ready)
  await expect(reveal).toHaveAttribute('type', 'button')
  await expect(reveal.locator('button, a, input')).toHaveCount(0)
  await tabTo(page, reveal)
  await assertActionLayout(reveal)
  await page.screenshot({
    path: info.outputPath('flashcard-front-focused.png'),
  })
  await page.keyboard.press('Enter')
  await expect(hide).toBeFocused()
  await expect(
    page.getByText(cards[0]!.definition, { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText(cards[0]!.example_sentence, { exact: true })
  ).toHaveAttribute('lang', 'ja-JP')
  await expect(
    page.getByText(cards[0]!.translation, { exact: true })
  ).toBeVisible()
  await assertActionLayout(hide)
  await page.screenshot({ path: info.outputPath('flashcard-back-focused.png') })
  await page.keyboard.press('Space')
  await expect(reveal).toBeFocused()
  await expect(good).toHaveCount(0)

  const audio = page.getByRole('button', {
    name: audioLabels.ariaListen,
    exact: true,
  })
  await expect(audio).toHaveJSProperty('tagName', 'BUTTON')
  expect(
    await audio.evaluate(
      (element) =>
        element.parentElement?.closest('button, [role="button"]') === null
    )
  ).toBe(true)
  await page.keyboard.press('Tab')
  await expect(audio).toBeFocused()
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { fixturePlaybackCount?: number })
            .fixturePlaybackCount ?? 0
      )
    )
    .toBe(1)
  await expect(
    page.getByRole('button', { name: audioLabels.ariaStop, exact: true })
  ).toBeVisible()
  await expect(reveal).toBeVisible()
  await expect(good).toHaveCount(0)
  expect(fixture.calls.filter((call) => call.path === '/api/tts')).toEqual([
    { method: 'POST', path: '/api/tts', body: { text: cards[0]!.word } },
  ])
  expect(fixture.calls.filter((call) => call.path.endsWith('/review'))).toEqual(
    []
  )
  await page.keyboard.press('Space')
  await expect(audio).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  await expect(reveal).toBeFocused()
  await page.keyboard.press('Space')
  await expect(hide).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(reveal).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(hide).toBeFocused()
  await tabTo(page, good)
  await page.keyboard.press('Space')
  await expect(page.getByText(cards[1]!.word, { exact: true })).toBeVisible()
  await expect(page.getByText(cards[0]!.word, { exact: true })).toHaveCount(0)
  await expect(reveal).toBeVisible()
  await expect(hide).toHaveCount(0)
  await expect(good).toHaveCount(0)
  expect(fixture.calls.filter((call) => call.path.endsWith('/review'))).toEqual(
    [
      {
        method: 'POST',
        path: '/api/flashcards/701/review',
        body: { quality: 4 },
      },
    ]
  )
  await tabTo(page, reveal)
  await assertActionLayout(reveal)
  await page.keyboard.press('Space')
  await expect(hide).toBeFocused()
  await expect(
    page.getByText(cards[1]!.definition, { exact: true })
  ).toBeVisible()
  await assertActionLayout(hide)
  await page.screenshot({ path: info.outputPath('flashcard-next-back.png') })
  await page.keyboard.press('Enter')
  await expect(reveal).toBeFocused()
  expect(fixture.unexpected).toEqual([])
})
