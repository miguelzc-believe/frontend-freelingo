import { expect, test, type Page } from '@playwright/test'

// Use Chromium's generated microphone, not committed or recorded user audio.
// Desktop and mobile-emulated Chromium both use the native capture pipeline.
// This is not physical-device acceptance. The existing config owns webServer/CSP/auth.
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
      violations: [] as string[],
      contextsClosed: 0,
      tracksStopped: 0,
      pcmMessages: 0,
      nonSilentPcmMessages: 0,
      stopAcknowledgements: 0,
      portsClosed: 0,
      nodesDisconnected: 0,
    }
    const diagnostics = {
      secureContext: window.isSecureContext,
      mediaDevicesAvailable: Boolean(navigator.mediaDevices),
      audioContextAvailable: typeof AudioContext !== 'undefined',
      audioWorkletAvailable: typeof AudioWorklet !== 'undefined',
      permissionState: 'pending',
      microphoneAllowed: null as boolean | null,
      modulePath: null as string | null,
      moduleSameOrigin: null as boolean | null,
      events: [] as {
        operation: string
        outcome: string
        timestamp: number
        name?: string
        message?: string
      }[],
    }
    const record = (operation: string, outcome: string, error?: unknown) => {
      if (diagnostics.events.length >= 20) return
      diagnostics.events.push({
        operation,
        outcome,
        timestamp: performance.now(),
        ...(error instanceof Error
          ? { name: error.name, message: error.message }
          : {}),
      })
    }
    Object.assign(window, {
      recorderObservations: observations,
      recorderDiagnostics: diagnostics,
    })
    const policyDocument = document as Document & {
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean }
      featurePolicy?: { allowsFeature: (feature: string) => boolean }
    }
    const policy =
      policyDocument.permissionsPolicy ?? policyDocument.featurePolicy
    if (policy)
      diagnostics.microphoneAllowed = policy.allowsFeature('microphone')
    if (navigator.permissions) {
      void navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then(
          (permission) => {
            diagnostics.permissionState = permission.state
            permission.addEventListener('change', () => {
              diagnostics.permissionState = permission.state
            })
          },
          (error: unknown) => {
            diagnostics.permissionState = 'query rejected'
            record('permissions.query', 'rejected', error)
          }
        )
    } else diagnostics.permissionState = 'unavailable'
    if (navigator.mediaDevices) {
      const getUserMedia = navigator.mediaDevices.getUserMedia
      navigator.mediaDevices.getUserMedia = async function (...args) {
        record('getUserMedia', 'called')
        try {
          const stream = await getUserMedia.apply(this, args)
          record('getUserMedia', 'resolved')
          return stream
        } catch (error) {
          record('getUserMedia', 'rejected', error)
          throw error
        }
      }
    }
    if (typeof AudioWorklet !== 'undefined') {
      const addModule = AudioWorklet.prototype.addModule
      AudioWorklet.prototype.addModule = async function (...args) {
        // Retain only the resolved path and origin comparison, never query,
        // fragment or URL credentials. The native call still gets exact args.
        try {
          const moduleUrl = new URL(String(args[0]), document.baseURI)
          diagnostics.modulePath = moduleUrl.pathname
          diagnostics.moduleSameOrigin = moduleUrl.origin === location.origin
        } catch {
          diagnostics.modulePath = null
          diagnostics.moduleSameOrigin = null
        }
        record('audioWorklet.addModule', 'called')
        try {
          await addModule.apply(this, args)
          record('audioWorklet.addModule', 'resolved')
        } catch (error) {
          record('audioWorklet.addModule', 'rejected', error)
          throw error
        }
      }
    }
    if (typeof AudioWorkletNode !== 'undefined') {
      const NativeAudioWorkletNode = AudioWorkletNode
      window.AudioWorkletNode = new Proxy(NativeAudioWorkletNode, {
        construct(target, args, newTarget) {
          const node = Reflect.construct(
            target,
            args,
            newTarget
          ) as AudioWorkletNode
          if (args[1] === 'voice-recorder') {
            // Observe this native port once, without replacing onmessage, starting
            // the port early, storing PCM or changing any production message.
            node.port.addEventListener(
              'message',
              ({
                data,
              }: MessageEvent<{
                type?: string
                samples?: unknown
              }>) => {
                if (
                  data.type === 'samples' &&
                  data.samples instanceof Float32Array
                ) {
                  observations.pcmMessages++
                  if (data.samples.some((sample) => sample !== 0)) {
                    observations.nonSilentPcmMessages++
                  }
                } else if (data.type === 'stopped') {
                  observations.stopAcknowledgements++
                }
              }
            )
            const closePort = node.port.close
            node.port.close = function () {
              closePort.call(this)
              observations.portsClosed++
            }
            node.disconnect = new Proxy(node.disconnect, {
              apply(target, thisArg, args) {
                const result: unknown = Reflect.apply(target, thisArg, args)
                observations.nodesDisconnected++
                return result
              },
            })
          }
          return node
        },
      })
    }
    document.addEventListener('securitypolicyviolation', (event) => {
      observations.violations.push(
        `${event.violatedDirective}: ${event.blockedURI}`
      )
    })
    const close = AudioContext.prototype.close
    AudioContext.prototype.close = async function () {
      await close.call(this)
      if (this.state === 'closed') observations.contextsClosed++
    }
    const stop = MediaStreamTrack.prototype.stop
    MediaStreamTrack.prototype.stop = function () {
      stop.call(this)
      if (this.readyState === 'ended') observations.tracksStopped++
    }
  })
})

// afterEach has its own hook budget, so an initialization timeout still leaves
// diagnostics attached. No request bodies, device identifiers or PCM are saved.
test.afterEach(async ({ page }, info) => {
  let diagnostics: unknown
  try {
    diagnostics = await page.evaluate(() => {
      const observed = window as Window & {
        recorderDiagnostics?: unknown
        recorderObservations?: unknown
      }
      return {
        diagnostics: observed.recorderDiagnostics,
        observations: observed.recorderObservations,
      }
    })
  } catch (error) {
    diagnostics = {
      retrievalFailed:
        error instanceof Error ? error.message : 'Page unavailable',
    }
  }
  await info.attach('voice-recorder-diagnostics', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  })
})

async function fixture(page: Page) {
  const uploads: Buffer[] = []
  const reviews: unknown[] = []
  const unexpected: string[] = []
  await page.route('**/api/flashcards/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/flashcards/due' && request.method() === 'GET') {
      return route.fulfill({
        json: {
          due: [
            {
              id: 701,
              study_plan_id: 42,
              word: 'hello',
              definition: 'A greeting',
              example_sentence: '',
              translation: '',
              ease_factor: 2.5,
              interval: 0,
              repetitions: 0,
            },
            {
              id: 702,
              study_plan_id: 42,
              word: 'goodbye',
              definition: 'A farewell',
              example_sentence: '',
              translation: '',
              ease_factor: 2.5,
              interval: 0,
              repetitions: 0,
            },
          ],
          total: 2,
        },
      })
    }
    if (path === '/api/flashcards/701/review' && request.method() === 'POST') {
      reviews.push(request.postDataJSON())
      return route.fulfill({ json: { ok: true } })
    }
    unexpected.push(`${request.method()} ${path}`)
    await route.abort()
  })
  await page.route('**/api/stt', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['content-type']).toContain(
      'multipart/form-data; boundary='
    )
    uploads.push(route.request().postDataBuffer()!)
    await route.fulfill({ json: { text: 'hello' } })
  })
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Speaking', exact: true }).click()
  return { uploads, reviews, unexpected }
}

function assertWav(body: Buffer) {
  const text = body.toString('latin1')
  expect(text).toContain('name="study_plan_id"\r\n\r\n42\r\n')
  expect(text).toContain('filename="recording.wav"')
  expect(text).toContain('Content-Type: audio/wav')
  expect(text).not.toContain('name="language"')
  const start = body.indexOf(Buffer.from('RIFF'))
  expect(start).toBeGreaterThan(0)
  const wav = body.subarray(start)
  expect(wav.subarray(8, 12).toString()).toBe('WAVE')
  expect(wav.readUInt16LE(20)).toBe(1)
  expect(wav.readUInt16LE(22)).toBe(1)
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(34)).toBe(16)
  const size = wav.readUInt32LE(40)
  expect(size).toBeGreaterThan(0)
  expect(size % 2).toBe(0)
  expect(wav.readUInt32LE(4)).toBe(36 + size)
  expect(wav.subarray(44, 44 + size).some((byte) => byte !== 0)).toBe(true)
}

async function observations(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          recorderObservations?: {
            violations: string[]
            contextsClosed: number
            tracksStopped: number
            pcmMessages: number
            nonSilentPcmMessages: number
            stopAcknowledgements: number
            portsClosed: number
            nodesDisconnected: number
          }
        }
      ).recorderObservations!
  )
}

async function expectNativeCaptureActive(page: Page) {
  // Count only real worklet messages. Non-silent PCM proves generated microphone
  // input has reached the page, rather than assuming enough wall time elapsed.
  await expect
    .poll(async () => (await observations(page)).nonSilentPcmMessages)
    .toBeGreaterThan(0)
}

async function expectNativeCaptureReleased(page: Page) {
  // These are completed native operations, not just calls to cleanup methods.
  // This positive barrier cannot pass before a capture has been released.
  await expect
    .poll(async () => {
      const observed = await observations(page)
      return {
        contextsClosed: observed.contextsClosed,
        tracksEnded: observed.tracksStopped >= 1,
        portsClosed: observed.portsClosed,
        nodesDisconnected: observed.nodesDisconnected,
      }
    })
    .toEqual({
      contextsClosed: 1,
      tracksEnded: true,
      portsClosed: 1,
      nodesDisconnected: 1,
    })
}

const workletPath = '/audio/voice-recorder.worklet.js'

async function expectNativeModuleLoaded(page: Page) {
  // Worklet fetches need not emit a Page response event. Observe the real
  // addModule promise instead; WAV assertions later prove native PCM capture.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const diagnostics = (
          window as Window & {
            recorderDiagnostics?: {
              modulePath: string | null
              moduleSameOrigin: boolean | null
              events: { operation: string; outcome: string }[]
            }
          }
        ).recorderDiagnostics
        return {
          path: diagnostics?.modulePath,
          sameOrigin: diagnostics?.moduleSameOrigin,
          resolved:
            diagnostics?.events.some(
              (event) =>
                event.operation === 'audioWorklet.addModule' &&
                event.outcome === 'resolved'
            ) ?? false,
        }
      })
    )
    .toEqual({ path: workletPath, sameOrigin: true, resolved: true })
}

for (const mode of ['manual', 'automatic'] as const) {
  test(`${mode} stop loads native worklet under CSP and delivers exactly once`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const data = await fixture(page)
    let automaticUploadElapsed: number | null = null
    if (mode === 'automatic') {
      page.on('request', async (request) => {
        if (new URL(request.url()).pathname !== '/api/stt') return
        automaticUploadElapsed = await page.evaluate(() => {
          const diagnostics = (
            window as Window & {
              recorderDiagnostics?: {
                events: {
                  operation: string
                  outcome: string
                  timestamp: number
                }[]
              }
            }
          ).recorderDiagnostics!
          const initialized = diagnostics.events.find(
            (event) =>
              event.operation === 'audioWorklet.addModule' &&
              event.outcome === 'resolved'
          )
          return initialized ? performance.now() - initialized.timestamp : -1
        })
      })
    }
    // Independent HTTP serving check, not a claim about native worklet fetch
    // visibility. Native loading remains subject to the document's CSP.
    const response = await page.request.get(workletPath)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toMatch(/javascript/)
    expect(await response.text()).toContain(
      "registerProcessor('voice-recorder'"
    )
    expect(response.headers()['content-security-policy']).toContain(
      "script-src 'self'"
    )
    await page
      .getByRole('button', { name: 'Start recording', exact: true })
      .click()
    await expectNativeModuleLoaded(page)
    await expectNativeCaptureActive(page)
    if (mode === 'manual') {
      expect(data.uploads).toHaveLength(0)
      await page
        .getByRole('button', { name: 'Stop recording', exact: true })
        .click()
    }
    // Real 5s capture + up to 3s ACK + 7s resampling/STT/delivery margin.
    // This observation deadline does not alter production clocks or stop early.
    await expect
      .poll(() => data.reviews.length, {
        timeout: mode === 'automatic' ? 15000 : 5000,
      })
      .toBe(1)
    if (mode === 'automatic') {
      await expect.poll(() => automaticUploadElapsed).not.toBeNull()
      expect(automaticUploadElapsed).toBeGreaterThanOrEqual(5000)
    }
    expect(data.uploads).toHaveLength(1)
    assertWav(data.uploads[0]!)
    expect(data.reviews).toEqual([{ quality: 5 }])
    await expectNativeCaptureReleased(page)
    expect((await observations(page)).stopAcknowledgements).toBe(1)
    // Advancing to the next card and returning to enabled idle recording proves
    // the transcription/review callback settled after native capture shut down.
    await expect(page.getByText('A farewell', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Start recording', exact: true })
    ).toBeEnabled()
    expect(data.uploads).toHaveLength(1)
    expect(data.reviews).toEqual([{ quality: 5 }])
    expect((await observations(page)).violations).toEqual([])
    expect(errors).toEqual([])
    expect(data.unexpected).toEqual([])
  })
}

test('cancelling speaking mode releases native capture without STT', async ({
  page,
}) => {
  const data = await fixture(page)
  await page
    .getByRole('button', { name: 'Start recording', exact: true })
    .click()
  await expectNativeModuleLoaded(page)
  await expectNativeCaptureActive(page)
  await page.getByRole('button', { name: 'Standard', exact: true }).click()
  await expectNativeCaptureReleased(page)
  expect((await observations(page)).stopAcknowledgements).toBe(0)
  await expect(
    page.getByRole('button', { name: 'tap to reveal', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start recording', exact: true })
  ).toHaveCount(0)
  expect(data.uploads).toHaveLength(0)
  expect(data.reviews).toHaveLength(0)
  await page.goto('/dashboard')
  expect(data.uploads).toHaveLength(0)
  expect(data.reviews).toHaveLength(0)
})

test('native missing-module rejection cleans up without deprecated fallback or upload', async ({
  page,
}) => {
  const data = await fixture(page)
  const missingPath = '/audio/voice-recorder-intentionally-missing.worklet.js'
  // Failure-only URL injection, not a simulated rejection or page-route abort.
  // The existing diagnostic wrapper still calls the original native addModule,
  // whose actual loader must reject this nonexistent same-origin module.
  await page.evaluate((path) => {
    const observedAddModule = AudioWorklet.prototype.addModule
    AudioWorklet.prototype.addModule = function (url, options) {
      if (
        new URL(String(url), document.baseURI).pathname !==
        '/audio/voice-recorder.worklet.js'
      ) {
        return observedAddModule.call(this, url, options)
      }
      return observedAddModule.call(this, path, options)
    }
  }, missingPath)
  await page
    .getByRole('button', { name: 'Start recording', exact: true })
    .click()
  await expect
    .poll(async () => (await observations(page)).contextsClosed)
    .toBe(1)
  expect((await observations(page)).tracksStopped).toBeGreaterThanOrEqual(1)
  await expect(
    page.getByRole('button', { name: 'Start recording', exact: true })
  ).toContainText('Error')
  const failure = await page.evaluate(() => {
    const diagnostics = (
      window as Window & {
        recorderDiagnostics?: {
          modulePath: string | null
          moduleSameOrigin: boolean | null
          events: {
            operation: string
            outcome: string
            name?: string
            message?: string
          }[]
        }
      }
    ).recorderDiagnostics!
    return {
      path: diagnostics.modulePath,
      sameOrigin: diagnostics.moduleSameOrigin,
      rejected: diagnostics.events.find(
        (event) =>
          event.operation === 'audioWorklet.addModule' &&
          event.outcome === 'rejected'
      ),
      resolved: diagnostics.events.some(
        (event) =>
          event.operation === 'audioWorklet.addModule' &&
          event.outcome === 'resolved'
      ),
    }
  })
  expect(failure.path).toBe(missingPath)
  expect(failure.sameOrigin).toBe(true)
  expect(failure.rejected?.name).toBeTruthy()
  expect(failure.rejected?.message).toBeTruthy()
  expect(failure.resolved).toBe(false)
  expect(data.uploads).toHaveLength(0)
  expect(data.reviews).toHaveLength(0)
})
