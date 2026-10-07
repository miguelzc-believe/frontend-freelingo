import { expect, test, type Page } from '@playwright/test'

const fixtureUser = {
  id: 1,
  username: 'learner',
  display_name: 'Test Learner',
  email: 'learner@example.invalid',
  role: 'admin',
  native_language: 'es',
  target_language: 'en-GB',
  ui_locale: 'en',
  learning_goals: [],
  is_verified: true,
  conversation_max_duration: 1800,
  conversation_inactivity_timeout: 180,
}

async function fixture(page: Page, role: 'admin' | 'user') {
  let canonical = {
    configured: false,
    provider: null as string | null,
    model: null as string | null,
    base_url: null as string | null,
    has_api_key: false,
    max_tokens: 8192,
    revision: 0,
  }
  let saves = 0
  let tests = 0
  let voiceSaves = 0
  let voiceTests = 0
  let adminReads = 0
  const voiceSettings = {
    tts: {
      configured: false,
      base_url: null as string | null,
      model: null as string | null,
      has_api_key: false,
      revision: 0,
      voice: 'alloy',
      speed: 1,
    },
    stt: {
      configured: false,
      base_url: null as string | null,
      model: null as string | null,
      has_api_key: false,
      revision: 0,
    },
  }
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { ...fixtureUser, role } })
  )
  await page.route('**/api/llm-settings/status', (route) =>
    route.fulfill({
      json: {
        configured: canonical.configured,
        provider: canonical.provider,
        model: canonical.model,
      },
    })
  )
  await page.route('**/api/{tts,stt}-settings/status', async (route) => {
    const kind = route.request().url().includes('tts-settings') ? 'tts' : 'stt'
    const { configured, model } = voiceSettings[kind]
    return route.fulfill({ json: { configured, model } })
  })
  await page.route('**/api/admin/{tts,stt}-settings{,/test}', async (route) => {
    const url = route.request().url()
    const kind = url.includes('tts-settings') ? 'tts' : 'stt'
    if (role !== 'admin')
      return route.fulfill({ status: 403, json: { detail: 'Forbidden' } })
    if (route.request().method() === 'GET')
      return route.fulfill({ json: voiceSettings[kind] })
    const draft = route.request().postDataJSON() as {
      base_url: string
      model: string
      api_key?: string
      clear_api_key?: boolean
      voice?: string
      speed?: number
    }
    if (url.endsWith('/test')) {
      voiceTests++
      return route.fulfill({
        json:
          kind === 'tts'
            ? { ok: true, audio_base64: 'SUQz', content_type: 'audio/mpeg' }
            : { ok: true },
      })
    }
    voiceSaves++
    if (kind === 'tts') {
      voiceSettings.tts = {
        ...voiceSettings.tts,
        configured: true,
        base_url: draft.base_url,
        model: draft.model,
        has_api_key:
          Boolean(draft.api_key) ||
          (!draft.clear_api_key && voiceSettings.tts.has_api_key),
        revision: voiceSettings.tts.revision + 1,
        voice: draft.voice ?? 'alloy',
        speed: draft.speed ?? 1,
      }
      return route.fulfill({ json: voiceSettings.tts })
    }
    voiceSettings.stt = {
      ...voiceSettings.stt,
      configured: true,
      base_url: draft.base_url,
      model: draft.model,
      has_api_key:
        Boolean(draft.api_key) ||
        (!draft.clear_api_key && voiceSettings.stt.has_api_key),
      revision: voiceSettings.stt.revision + 1,
    }
    return route.fulfill({ json: voiceSettings.stt })
  })
  await page.route('**/api/admin/llm-settings{,/test}', async (route) => {
    const request = route.request()
    if (role !== 'admin')
      return route.fulfill({ status: 403, json: { detail: 'Forbidden' } })
    if (request.method() === 'GET') {
      adminReads++
      return route.fulfill({ json: canonical })
    }
    const draft = request.postDataJSON() as {
      provider: string
      model: string
      base_url: string | null
      api_key?: string
      clear_api_key?: boolean
      max_tokens?: number
    }
    if (request.url().endsWith('/test')) {
      tests++
      if (draft.model === 'fail-test')
        return route.fulfill({
          status: 502,
          json: { detail: 'llm_test_failed' },
        })
      return route.fulfill({ json: { ok: true } })
    }
    saves++
    canonical = {
      configured: true,
      provider: draft.provider,
      model: draft.model,
      base_url: draft.base_url,
      has_api_key:
        Boolean(draft.api_key) ||
        (!draft.clear_api_key && canonical.has_api_key),
      max_tokens: draft.max_tokens ?? 8192,
      revision: canonical.revision + 1,
    }
    return route.fulfill({ json: canonical })
  })
  return {
    saves: () => saves,
    tests: () => tests,
    adminReads: () => adminReads,
    voiceSaves: () => voiceSaves,
    voiceTests: () => voiceTests,
    voiceSettings: () => voiceSettings,
  }
}

async function login(page: Page) {
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
  })
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve()
    }
    void originalPlay
  })
})

test('admin tests and saves global draft, refreshes banner, reloads without exposing keys', async ({
  page,
}) => {
  const state = await fixture(page, 'admin')
  await login(page)
  const bannerLink = page.getByRole('link', {
    name: 'AI settings',
    exact: true,
  })
  await expect(bannerLink).toBeVisible()
  await bannerLink.click()
  await expect(page).toHaveURL(/\/settings#ai$/)
  const panel = page.locator('#ai')
  const key = panel.getByLabel('API key', { exact: true })
  await expect(key).toHaveValue('')
  await panel.getByLabel('Provider', { exact: true }).selectOption('openai')
  await panel.getByLabel('Model', { exact: true }).fill('draft-model')
  await key.fill('browser-fixture-only-key')
  await expect(key).toHaveAttribute('type', 'password')
  await page.keyboard.press('Tab')
  const saveButton = panel.getByRole('button', {
    name: 'Save changes',
    exact: true,
  })
  await expect(saveButton).toBeFocused()
  const outline = await saveButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
  await panel
    .locator('form')
    .first()
    .getByRole('button', { name: 'Test connection', exact: true })
    .click()
  await expect(panel.locator('output')).toContainText(
    'Connection test succeeded'
  )
  expect(state.tests()).toBe(1)
  expect(state.saves()).toBe(0)
  await expect(key).toHaveValue('browser-fixture-only-key')
  await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(panel.locator('output').first()).toHaveText('Global AI settings saved.')
  await expect(key).toHaveValue('')
  await expect(bannerLink).toBeVisible()
  expect(state.saves()).toBe(1)
  await page.reload()
  await expect(panel.getByLabel('Model', { exact: true })).toHaveValue(
    'draft-model'
  )
  await expect(key).toHaveValue('')
  await expect(panel).toContainText('A key is saved.')
  const persistence = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage })
  )
  expect(persistence).not.toContain('browser-fixture-only-key')
  await panel.getByLabel('Provider', { exact: true }).selectOption('deepseek')
  await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(panel.getByRole('alert')).toHaveText(
    'Enter an API key for this provider and URL.'
  )
  expect(state.saves()).toBe(1)
  await key.fill('replacement-fixture-only-key')
  await panel.getByLabel('Model', { exact: true }).fill('fail-test')
  await panel
    .locator('form')
    .first()
    .getByRole('button', { name: 'Test connection', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText(
    'Connection test failed.'
  )
  await expect(key).toHaveValue('replacement-fixture-only-key')
  expect(state.saves()).toBe(1)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('regular users see missing status and administrator guidance without an editable form', async ({
  page,
}) => {
  const state = await fixture(page, 'user')
  await login(page)
  await page.getByRole('link', { name: 'AI settings', exact: true }).click()
  const panel = page.locator('#ai')
  await expect(panel).toContainText('Contact your administrator.')
  await expect(panel.getByText('AI is not configured.', { exact: false })).toBeVisible()
  await expect(panel.locator('input, select, form')).toHaveCount(0)
  expect(state.adminReads()).toBe(0)
  expect(state.saves()).toBe(0)
  expect(state.tests()).toBe(0)
})

test('admin configures OmniRoute TTS and STT independently from chat, and status banner refreshes', async ({
  page,
}) => {
  const state = await fixture(page, 'admin')
  await login(page)
  await page.getByRole('link', { name: 'AI settings', exact: true }).click()
  const panel = page.locator('#ai')
  await expect(page.getByText('Text-to-speech is not configured. Voice playback is unavailable.')).toBeVisible()
  await expect(page.getByText('Speech-to-text is not configured. Voice input is unavailable.')).toBeVisible()

  await panel.getByLabel('TTS model', { exact: true }).fill('openai/gpt-4o-mini-tts')
  await panel.getByLabel('TTS API key', { exact: true }).fill('tts-fixture-only-key')
  await expect(
    page.getByText(/Text-to-speech is not configured/)
  ).toBeVisible()
  await expect(
    page.getByText(/Speech-to-text is not configured/)
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Test connection' }).nth(1).click()
  await expect(panel.getByText('Connection test succeeded.')).toBeVisible()
  await panel.getByRole('button', { name: 'Save' }).nth(1).click()
  await expect(panel.getByText('Voice settings saved.')).toBeVisible()
  await expect(panel.getByLabel('TTS API key')).toHaveValue('')
  expect(state.voiceSaves()).toBe(1)

  await panel.getByLabel('STT model', { exact: true }).fill('groq/whisper-large-v3-turbo')
  await panel.getByLabel('STT API key', { exact: true }).fill('stt-fixture-only-key')
  await panel.getByRole('button', { name: 'Test connection' }).nth(2).click()
  expect(state.voiceTests()).toBe(2)
  await panel.getByRole('button', { name: 'Save' }).nth(2).click()
  await expect(panel.getByLabel('STT API key')).toHaveValue('')
  expect(state.voiceSaves()).toBe(2)
  await expect(panel.getByLabel('TTS model')).toHaveValue('openai/gpt-4o-mini-tts')
  await expect(panel.getByLabel('STT model')).toHaveValue('groq/whisper-large-v3-turbo')
  await expect(page.getByText(/Text-to-speech is not configured/)).toHaveCount(0)
  await expect(page.getByText(/Speech-to-text is not configured/)).toHaveCount(0)

  const browserState = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage })
  )
  expect(browserState).not.toContain('tts-fixture-only-key')
  expect(browserState).not.toContain('stt-fixture-only-key')
  expect(state.voiceSettings().tts.model).toBe('openai/gpt-4o-mini-tts')
  expect(state.voiceSettings().stt.model).toBe('groq/whisper-large-v3-turbo')
})
