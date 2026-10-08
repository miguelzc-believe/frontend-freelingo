import { expect, test, type Page } from '@playwright/test'
import { float32ToWav } from '../../src/lib/audio'

// Generated microphone + generated PCM fixture only. No user speech, provider
// calls, fake TTS implementation or production-clock overrides.
test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
    const observations = {
      micRequests: 0,
      tracksStopped: 0,
      contextsClosed: 0,
      pcm: 0,
      stopped: 0,
      urls: 0,
      revoked: 0,
      sockets: 0,
      violations: [] as string[],
    }
    Object.assign(window, { voiceObservations: observations })
    const getUserMedia = navigator.mediaDevices.getUserMedia
    navigator.mediaDevices.getUserMedia = function (...args) {
      observations.micRequests++
      return getUserMedia.apply(this, args)
    }
    const stop = MediaStreamTrack.prototype.stop
    MediaStreamTrack.prototype.stop = function () {
      stop.call(this)
      if (this.readyState === 'ended') observations.tracksStopped++
    }
    const close = AudioContext.prototype.close
    AudioContext.prototype.close = async function () {
      await close.call(this)
      if (this.state === 'closed') observations.contextsClosed++
    }
    const NativeNode = AudioWorkletNode
    window.AudioWorkletNode = new Proxy(NativeNode, {
      construct(target, args, newTarget) {
        const node = Reflect.construct(
          target,
          args,
          newTarget
        ) as AudioWorkletNode
        node.port.addEventListener(
          'message',
          ({
            data,
          }: MessageEvent<{ type: string; samples?: Float32Array }>) => {
            if (
              data.type === 'samples' &&
              data.samples?.some((value) => value !== 0)
            )
              observations.pcm++
            if (data.type === 'stopped') observations.stopped++
          }
        )
        return node
      },
    })
    const create = URL.createObjectURL
    URL.createObjectURL = function (value) {
      observations.urls++
      return create.call(this, value)
    }
    const revoke = URL.revokeObjectURL
    URL.revokeObjectURL = function (value) {
      observations.revoked++
      revoke.call(this, value)
    }
    window.WebSocket = new Proxy(WebSocket, {
      construct(target, args) {
        observations.sockets++
        return Reflect.construct(target, args)
      },
    })
    document.addEventListener('securitypolicyviolation', (event) =>
      observations.violations.push(event.violatedDirective)
    )
  })
})

async function observed(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          voiceObservations?: {
            micRequests: number
            tracksStopped: number
            contextsClosed: number
            pcm: number
            stopped: number
            urls: number
            revoked: number
            sockets: number
            violations: string[]
          }
        }
      ).voiceObservations!
  )
}

function audioFixture() {
  const samples = Float32Array.from(
    { length: 32000 },
    (_, index) => Math.sin((2 * Math.PI * 440 * index) / 16000) * 0.1
  )
  return Buffer.from(float32ToWav(samples, 16000))
}

function extractAudio(body: Buffer) {
  const start = body.indexOf('RIFF')
  expect(start).toBeGreaterThan(0)
  const size = body.readUInt32LE(start + 40)
  const wav = body.subarray(start, start + 44 + size)
  expect(wav.subarray(8, 12).toString()).toBe('WAVE')
  expect(wav.readUInt16LE(22)).toBe(1)
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(34)).toBe(16)
  expect(size).toBeGreaterThan(0)
  expect(wav.subarray(44).some((byte) => byte !== 0)).toBe(true)
  return wav
}

async function fixture(
  page: Page,
  sttFailure = false,
  maxRecordingSeconds = 120
) {
  const uploads: Buffer[] = []
  let activityCount = 0
  let closeCount = 0
  const audioRequests: string[] = []
  const session = {
    session_id: 'browser-session',
    conversation_id: 1,
    target_language: 'en-GB',
    cefr_level: 'A1',
    expires_at: new Date(Date.now() + 600000).toISOString(),
    inactivity_expires_at: new Date(Date.now() + 180000).toISOString(),
    max_recording_seconds: maxRecordingSeconds,
  }
  const result = {
    turn_id: 'turn',
    user_text: 'Generated input transcript',
    assistant_text: 'This is a fixture transcript.',
    user_audio_url: null,
    assistant_audio_url:
      '/api/conversation/sessions/browser-session/turns/turn/audio/assistant',
    status: 'complete',
    stt_attempts: 1,
    memory_updated: true,
    remaining_seconds: 600,
    inactivity_expires_at: session.inactivity_expires_at,
  }
  await page.route('**/api/conversation/sessions**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/conversation/sessions') {
      expect(request.method()).toBe('POST')
      return route.fulfill({ json: session })
    }
    if (path.endsWith('/greeting'))
      return route.fulfill({
        json: {
          ...result,
          turn_id: 'greeting',
          assistant_text: 'Hello browser learner',
          user_text: null,
          assistant_audio_url: null,
          memory_updated: false,
        },
      })
    if (path.endsWith('/activity')) {
      activityCount++
      return route.fulfill({ json: { ...session, remaining_seconds: 600 } })
    }
    if (path.endsWith('/close')) {
      closeCount++
      return route.fulfill({ json: { ok: true } })
    }
    if (path.endsWith('/turns')) {
      expect(request.headers()['content-type']).toContain(
        'multipart/form-data; boundary='
      )
      uploads.push(request.postDataBuffer()!)
      return route.fulfill({
        json: sttFailure
          ? {
              ...result,
              user_text: null,
              assistant_text: null,
              assistant_audio_url: null,
              status: 'stt_failed',
              stt_attempts: uploads.length,
            }
          : result,
      })
    }
    if (path.endsWith('/audio/assistant')) {
      audioRequests.push(request.headers()['authorization'] ?? '')
      return route.fulfill({
        contentType: 'audio/wav',
        body: audioFixture(),
        headers: { 'cache-control': 'no-store' },
      })
    }
    throw new Error(`Unexpected voice endpoint ${path}`)
  })
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/conversation')
  await page.getByRole('button', { name: 'Start Session', exact: true }).click()
  await expect(
    page.getByText('Hello browser learner', { exact: true })
  ).toBeVisible()
  return {
    uploads,
    audioRequests,
    activityCount: () => activityCount,
    closeCount: () => closeCount,
  }
}

async function record(page: Page) {
  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await expect.poll(async () => (await observed(page)).pcm).toBeGreaterThan(0)
}

test('explicit capture, valid WAV upload, authenticated per-message players and session cleanup', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const data = await fixture(page)
  expect((await observed(page)).micRequests).toBe(0)
  expect((await observed(page)).sockets).toBe(0)
  await record(page)
  expect(data.uploads).toHaveLength(0)
  await page.getByRole('button', { name: 'Stop and send', exact: true }).click()
  await expect(
    page.getByText('Generated input transcript', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('This is a fixture transcript.', { exact: true })
  ).toBeVisible()
  await expect.poll(() => data.uploads.length).toBe(1)
  extractAudio(data.uploads[0]!)
  await expect.poll(async () => (await observed(page)).contextsClosed).toBe(1)
  expect((await observed(page)).tracksStopped).toBeGreaterThan(0)
  expect((await observed(page)).stopped).toBe(1)
  await expect(page.locator('audio')).toHaveCount(2)
  expect(data.audioRequests).toEqual(['Bearer fixture-access'])
  const sliders = page.getByRole('slider', {
    name: 'Audio playback progress',
    exact: true,
  })
  await expect(sliders.nth(1)).toBeEnabled()
  await page
    .getByRole('button', { name: 'Pause voice message', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Play voice message', exact: true })
    .first()
    .click()
  await expect
    .poll(() =>
      page
        .locator('audio')
        .evaluateAll(
          (audios) =>
            audios.filter((audio) => !(audio as HTMLAudioElement).paused).length
        )
    )
    .toBe(1)
  await sliders.first().fill('0')
  await page.getByRole('button', { name: 'End session', exact: true }).click()
  await expect(page.locator('audio')).toHaveCount(0)
  await expect.poll(() => data.closeCount()).toBe(1)
  expect((await observed(page)).revoked).toBe(2)
  expect((await observed(page)).violations).toEqual([])
  expect(errors).toEqual([])
  expect(data.activityCount()).toBeGreaterThanOrEqual(2)
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => /audio|voice/i.test(key))
    )
  ).toEqual([])
})

test('STT failure exposes only two manual retries using byte-identical WAV and UUID', async ({
  page,
}) => {
  const data = await fixture(page, true)
  await record(page)
  await page.getByRole('button', { name: 'Stop and send', exact: true }).click()
  const retry = page.getByRole('button', { name: /Retry transcription ·/ })
  await expect(retry).toBeEnabled()
  expect(data.uploads).toHaveLength(1)
  await retry.click()
  await expect(retry).toBeEnabled()
  expect(data.uploads).toHaveLength(2)
  await retry.click()
  await expect(retry).toHaveCount(0)
  await expect(
    page.getByText(
      'Both transcription retries have been used. Record a new message to continue.',
      { exact: true }
    )
  ).toBeVisible()
  expect(data.uploads).toHaveLength(3)
  const bytes = data.uploads.map(extractAudio)
  expect(bytes[1]!.equals(bytes[0]!)).toBe(true)
  expect(bytes[2]!.equals(bytes[0]!)).toBe(true)
  const ids = data.uploads.map(
    (body) =>
      body
        .toString('latin1')
        .match(/name="client_turn_id"\r\n\r\n([\da-f-]+)/)?.[1]
  )
  expect(new Set(ids).size).toBe(1)
  expect(ids[0]).toMatch(/^[\da-f-]{36}$/)
  await page.getByRole('button', { name: 'End session', exact: true }).click()
})

test('native capture stops and sends automatically at the server recording limit', async ({
  page,
}) => {
  const data = await fixture(page, false, 1)
  await record(page)
  await expect.poll(() => data.uploads.length).toBe(1)
  const wav = extractAudio(data.uploads[0]!)
  expect(wav.readUInt32LE(40)).toBeLessThanOrEqual(16000 * 2)
  await expect
    .poll(async () => (await observed(page)).tracksStopped)
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'End session', exact: true }).click()
})

test('end during native capture discards audio and releases the microphone', async ({
  page,
}) => {
  const data = await fixture(page)
  await record(page)
  await page.getByRole('button', { name: 'End session', exact: true }).click()
  await expect.poll(async () => (await observed(page)).contextsClosed).toBe(1)
  expect((await observed(page)).tracksStopped).toBeGreaterThan(0)
  expect(data.uploads).toHaveLength(0)
  expect((await observed(page)).urls).toBe(0)
})
