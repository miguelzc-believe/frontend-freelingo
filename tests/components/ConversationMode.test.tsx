import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationMode from '@/components/conversation/ConversationMode'
import { useAuthStore } from '@/store/auth'
import type { VoiceSession, VoiceTurnResult } from '@/lib/conversation-api'
import {
  blobBytes,
  captureFixture,
  deferred,
  generatedSamples,
} from '../helpers/voice-capture'
import { float32ToWav } from '@/lib/audio'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  starters: [] as string[],
  push: vi.fn(),
  review: vi.fn(),
}))
vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => mocks.starters }),
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.api }))
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: ({ open }: { open: boolean }) =>
    open ? <div>reviewPrompt</div> : null,
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowVoiceReviewPrompt: (...args: unknown[]) => mocks.review(...args),
}))

const session: VoiceSession = {
  session_id: 'session-1',
  conversation_id: 7,
  target_language: 'en-GB',
  cefr_level: 'B1',
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  inactivity_expires_at: new Date(Date.now() + 180_000).toISOString(),
  max_recording_seconds: 120,
}
const complete: VoiceTurnResult = {
  turn_id: 'turn-1',
  user_text: 'Hello there',
  assistant_text: 'Welcome back',
  user_audio_url:
    '/api/conversation/sessions/session-1/turns/turn-1/audio/user',
  assistant_audio_url:
    '/api/conversation/sessions/session-1/turns/turn-1/audio/assistant',
  status: 'complete',
  stt_attempts: 1,
  memory_updated: false,
  remaining_seconds: 600,
  inactivity_expires_at: session.inactivity_expires_at,
}
const greeting: VoiceTurnResult = {
  ...complete,
  turn_id: 'greeting',
  user_text: null,
  assistant_text: 'Hello learner',
  assistant_audio_url: null,
}
let capture: ReturnType<typeof captureFixture>
let result: VoiceTurnResult
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
let createUrl: ReturnType<typeof vi.fn>
let revokeUrl: ReturnType<typeof vi.fn>
let closeFetch: ReturnType<typeof vi.fn>

function response(value: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => value }
}
function uploads() {
  return mocks.api.mock.calls.filter(([url]) => String(url).endsWith('/turns'))
}
async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
  )
}
async function recordAndStop() {
  fireEvent.click(screen.getByRole('button', { name: 'record' }))
  await waitFor(() => expect(capture.nodes.length).toBeGreaterThan(0))
  const node = capture.nodes.at(-1)!
  act(() => node.emit({ type: 'samples', samples: generatedSamples() }))
  fireEvent.click(screen.getByRole('button', { name: 'stopAndSend' }))
  await act(async () => node.emit({ type: 'stopped' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  result = { ...complete }
  capture = captureFixture()
  createUrl = vi.fn(
    (blob: Blob) => `blob:audio-${blob.size}-${createUrl.mock.calls.length}`
  )
  revokeUrl = vi.fn()
  closeFetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', closeFetch)
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    })
  )
  play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    })
  pause = vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('pause'))
    })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  mocks.starters = []
  mocks.review.mockReturnValue(false)
  mocks.api.mockImplementation(async (url: string) => {
    if (url === '/api/conversation/sessions') return response(session)
    if (url.endsWith('/greeting')) return response(greeting)
    if (url.endsWith('/turns')) return response(result)
    if (url.endsWith('/activity'))
      return response({ ...session, remaining_seconds: 600 })
    if (url.includes('/audio/'))
      return {
        ok: true,
        blob: async () =>
          new Blob([float32ToWav(generatedSamples(), 16000)], {
            type: 'audio/wav',
          }),
      }
    return response(null)
  })
  useAuthStore.setState({ accessToken: 'token', user: null })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('explicit voice-message conversation', () => {
  it('orders the first six starters deterministically', () => {
    mocks.starters = [
      'Zulu',
      'Alpha',
      'Yankee',
      'Bravo',
      'Xray',
      'Charlie',
      'Extra',
    ]
    render(<ConversationMode />)
    expect(
      Array.from(
        screen
          .getByText('startersHint')
          .parentElement!.querySelectorAll('button'),
        (button) => button.textContent
      )
    ).toEqual(['Alpha', 'Bravo', 'Charlie', 'Xray', 'Yankee', 'Zulu'])
  })

  it('does not acquire a microphone on mount, start or autoStart; uses HTTP context and trial token', async () => {
    render(
      <ConversationMode
        autoStart
        targetLanguage="ja"
        voiceTrialToken="trial"
        conversationId={9}
        initialContext={[{ role: 'user', content: 'chat context' }]}
      />
    )
    await screen.findByText('Hello learner')
    expect(capture.media).not.toHaveBeenCalled()
    expect(capture.context).not.toHaveBeenCalled()
    const call = mocks.api.mock.calls.find(
      ([url]) => url === '/api/conversation/sessions'
    )
    expect(JSON.parse(call?.[1].body)).toEqual({
      target_language: 'ja',
      voice_trial_token: 'trial',
      conversation_id: 9,
      context: [{ role: 'user', content: 'chat context' }],
    })
    expect(
      mocks.api.mock.calls.some(([url]) => String(url).includes('warmup'))
    ).toBe(false)
  })

  it('restarts autoStart after StrictMode cleanup, closes the late aborted session and greets only the live run', async () => {
    const first = deferred<ReturnType<typeof response>>()
    const second = deferred<ReturnType<typeof response>>()
    const original = mocks.api.getMockImplementation()!
    const starts = () =>
      mocks.api.mock.calls.filter(
        ([url]) => url === '/api/conversation/sessions'
      )
    mocks.api.mockImplementation((url: string, options: RequestInit) => {
      if (url === '/api/conversation/sessions')
        return starts().length === 1 ? first.promise : second.promise
      return original(url, options)
    })
    const props = {
      autoStart: true,
      targetLanguage: 'ja',
      voiceTrialToken: 'trial',
      conversationId: 9,
    }
    const view = render(
      <StrictMode>
        <ConversationMode {...props} />
      </StrictMode>
    )
    await waitFor(() => expect(starts()).toHaveLength(2))
    const [firstCall, secondCall] = starts()
    const firstSignal = firstCall?.[1].signal as AbortSignal
    const secondSignal = secondCall?.[1].signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)
    expect(JSON.parse(secondCall?.[1].body)).toEqual({
      target_language: 'ja',
      voice_trial_token: 'trial',
      conversation_id: 9,
    })
    view.rerender(
      <StrictMode>
        <ConversationMode {...props} cefrLevel="C1" />
      </StrictMode>
    )
    act(() => useAuthStore.setState({ accessToken: 'refreshed-token' }))
    expect(starts()).toHaveLength(2)

    await act(async () =>
      second.resolve(response({ ...session, session_id: 'live-session' }))
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    await act(async () =>
      first.resolve(response({ ...session, session_id: 'aborted-session' }))
    )
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/aborted-session/close',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      })
    )
    expect(
      mocks.api.mock.calls
        .filter(([url]) => String(url).endsWith('/greeting'))
        .map(([url]) => url)
    ).toEqual(['/api/conversation/sessions/live-session/greeting'])
    expect(screen.getAllByText('Hello learner')).toHaveLength(1)
    expect(secondSignal.aborted).toBe(false)
    expect(capture.media).not.toHaveBeenCalled()
    expect(capture.context).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    view.rerender(
      <StrictMode>
        <ConversationMode {...props} cefrLevel="B2" />
      </StrictMode>
    )
    act(() => useAuthStore.setState({ accessToken: 'another-refresh' }))
    expect(starts()).toHaveLength(2)
    expect(secondSignal.aborted).toBe(true)
  })

  it('auto-starts once per account/language/trial/conversation scope, never on token refresh', async () => {
    const view = render(
      <ConversationMode
        autoStart
        targetLanguage="es"
        voiceTrialToken="trial-1"
        conversationId={1}
      />
    )
    const starts = () =>
      mocks.api.mock.calls.filter(
        ([url]) => url === '/api/conversation/sessions'
      )
    await waitFor(() => expect(starts()).toHaveLength(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    act(() => useAuthStore.setState({ accessToken: 'refreshed-token' }))
    view.rerender(
      <ConversationMode
        autoStart
        targetLanguage="es"
        voiceTrialToken="trial-1"
        conversationId={1}
      />
    )
    expect(starts()).toHaveLength(1)
    view.rerender(
      <ConversationMode
        autoStart
        targetLanguage="ja"
        voiceTrialToken="trial-1"
        conversationId={1}
      />
    )
    await waitFor(() => expect(starts()).toHaveLength(2))
    view.rerender(
      <ConversationMode
        autoStart
        targetLanguage="ja"
        voiceTrialToken="trial-2"
        conversationId={1}
      />
    )
    await waitFor(() => expect(starts()).toHaveLength(3))
    view.rerender(
      <ConversationMode
        autoStart
        targetLanguage="ja"
        voiceTrialToken="trial-2"
        conversationId={2}
      />
    )
    await waitFor(() => expect(starts()).toHaveLength(4))
    act(() =>
      useAuthStore.setState({
        user: {
          id: 2,
          username: 'other',
          displayName: 'Other',
          role: 'user',
          conversation_max_duration: 1800,
          conversation_inactivity_timeout: 180,
        },
      })
    )
    await waitFor(() => expect(starts()).toHaveLength(5))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    expect(
      starts().map((call) => JSON.parse(call[1].body).target_language)
    ).toEqual(['es', 'ja', 'ja', 'ja', 'ja'])
    expect(capture.media).not.toHaveBeenCalled()
    expect(capture.context).not.toHaveBeenCalled()
  })

  it.each(['network', '500', '409'] as const)(
    'allows only manual idempotent resend after %s without spending an STT retry',
    async (failure) => {
      const original = mocks.api.getMockImplementation()!
      mocks.api.mockImplementation((url: string, options: RequestInit) => {
        if (url.endsWith('/turns') && uploads().length === 1) {
          return failure === 'network'
            ? Promise.reject(new TypeError('lost response'))
            : Promise.resolve(
                response(
                  {
                    detail:
                      failure === '409' ? 'session_busy' : 'private diagnostic',
                  },
                  Number(failure)
                )
              )
        }
        return original(url, options)
      })
      render(<ConversationMode />)
      await start()
      await recordAndStop()
      const retry = await screen.findByRole('button', { name: 'retry' })
      expect(screen.queryByText('processing')).toBeNull()
      expect(screen.queryByRole('button', { name: /retry ·/ })).toBeNull()
      expect(uploads()).toHaveLength(1)
      result = {
        ...complete,
        user_text: null,
        assistant_text: null,
        assistant_audio_url: null,
        status: 'stt_failed',
        stt_attempts: 1,
      }
      const pending = deferred<ReturnType<typeof response>>()
      mocks.api.mockImplementation((url: string, options: RequestInit) =>
        url.endsWith('/turns') ? pending.promise : original(url, options)
      )
      fireEvent.click(retry)
      fireEvent.click(retry)
      expect(uploads()).toHaveLength(2)
      await act(async () => pending.resolve(response(result)))
      await screen.findByRole('button', { name: /retry ·/ })
      mocks.api.mockImplementation((url: string, options: RequestInit) =>
        url.endsWith('/turns')
          ? Promise.resolve(response({ ...result, stt_attempts: 2 }))
          : original(url, options)
      )
      fireEvent.click(screen.getByRole('button', { name: /retry ·/ }))
      await waitFor(() => expect(uploads()).toHaveLength(3))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /retry ·/ })).toBeEnabled()
      )
      mocks.api.mockImplementation((url: string, options: RequestInit) =>
        url.endsWith('/turns')
          ? Promise.resolve(response({ ...result, stt_attempts: 3 }))
          : original(url, options)
      )
      fireEvent.click(screen.getByRole('button', { name: /retry ·/ }))
      await screen.findByText('retryLimit')
      const forms = uploads().map((call) => call[1].body as FormData)
      expect(forms.map((form) => form.get('retry'))).toEqual([
        'false',
        'false',
        'true',
        'true',
      ])
      expect(
        new Set(forms.map((form) => form.get('client_turn_id'))).size
      ).toBe(1)
      const bytes = await Promise.all(
        forms.map((form) => blobBytes(form.get('audio') as Blob))
      )
      bytes.forEach((value) =>
        expect(new Uint8Array(value)).toEqual(new Uint8Array(bytes[0]!))
      )
      expect(capture.media).toHaveBeenCalledOnce()
    }
  )

  it('manually recovers a cached completed turn after a lost response without retranscribing', async () => {
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/turns') && uploads().length === 1
        ? Promise.reject(new TypeError('response lost after completion'))
        : original(url, options)
    )
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    fireEvent.click(await screen.findByRole('button', { name: 'retry' }))
    await screen.findByText('Welcome back')
    await screen.findByRole('button', { name: 'pause' })
    expect(
      uploads().map((call) => (call[1].body as FormData).get('retry'))
    ).toEqual(['false', 'false'])
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
    expect(screen.queryByText('processing')).toBeNull()
    expect(screen.getAllByText('Welcome back')).toHaveLength(1)
    expect(capture.media).toHaveBeenCalledOnce()
  })

  it('recovers a lost confirmed STT-retry response with retry=false before permitting further STT retry', async () => {
    result = {
      ...complete,
      user_text: null,
      assistant_text: null,
      assistant_audio_url: null,
      status: 'stt_failed',
    }
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    await screen.findByRole('button', { name: /retry ·/ })
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/turns')
        ? Promise.reject(new TypeError('lost retry response'))
        : original(url, options)
    )
    fireEvent.click(screen.getByRole('button', { name: /retry ·/ }))
    const resend = await screen.findByRole('button', { name: 'retry' })
    expect(screen.queryByRole('button', { name: /retry ·/ })).toBeNull()
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/turns')
        ? Promise.resolve(response({ ...result, stt_attempts: 3 }))
        : original(url, options)
    )
    fireEvent.click(resend)
    await screen.findByText('retryLimit')
    expect(
      uploads().map((call) => (call[1].body as FormData).get('retry'))
    ).toEqual(['false', 'true', 'false'])
    expect(screen.queryByRole('button', { name: /retry ·/ })).toBeNull()
  })

  it('marks invalid 422 recording terminal without stranding processing or ending the session', async () => {
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/turns')
        ? Promise.resolve(response({ detail: 'invalid_recording' }, 422))
        : original(url, options)
    )
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'errorTranscription'
    )
    expect(screen.queryByText('processing')).toBeNull()
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'play' })).toBeInTheDocument()
    expect(uploads()).toHaveLength(1)
  })

  it('captures explicitly, releases mic before upload, retains text and local user audio', async () => {
    result.memory_updated = true
    render(<ConversationMode />)
    await start()
    const pending = deferred<ReturnType<typeof response>>()
    mocks.api.mockImplementationOnce(async () =>
      response({ ...session, remaining_seconds: 600 })
    ) // record activity
    mocks.api.mockImplementationOnce(() => pending.promise) // turn
    await recordAndStop()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('button', { name: 'play' })).toHaveLength(1)
    expect(screen.getByText('processing')).toBeInTheDocument()
    await act(async () => pending.resolve(response(result)))
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(await screen.findByText('memorySavedToast')).toBeInTheDocument()
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(uploads()).toHaveLength(1)
    const form = uploads()[0]?.[1].body as FormData
    const bytes = new DataView(await blobBytes(form.get('audio') as Blob))
    expect(bytes.getUint16(22, true)).toBe(1)
    expect(bytes.getUint32(24, true)).toBe(16000)
    expect(bytes.getUint16(34, true)).toBe(16)
    expect(form.get('client_turn_id')).toMatch(/^[\da-f-]{36}$/)
    expect(form.get('retry')).toBe('false')
  })

  it('cancels capture without uploading or ending the session and sends only the new recording', async () => {
    render(<ConversationMode />)
    await start()
    expect(screen.queryByRole('button', { name: 'cancel' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    const discarded = capture.nodes[0]!
    act(() =>
      discarded.emit({ type: 'samples', samples: generatedSamples(3200) })
    )
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))

    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(discarded.port.close).toHaveBeenCalledOnce()
    expect(discarded.disconnect).toHaveBeenCalledOnce()
    expect(uploads()).toHaveLength(0)
    expect(createUrl).not.toHaveBeenCalled()
    expect(screen.getByText('Hello learner')).toBeInTheDocument()
    expect(screen.queryByText('processing')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'cancel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'record' })).toHaveFocus()
    expect(closeFetch).not.toHaveBeenCalled()

    act(() => {
      discarded.emit({ type: 'samples', samples: generatedSamples(3200) })
      discarded.emit({ type: 'stopped' })
    })
    await recordAndStop()
    await screen.findByText('Hello there')
    expect(uploads()).toHaveLength(1)
    const form = uploads()[0]?.[1].body as FormData
    const bytes = new DataView(await blobBytes(form.get('audio') as Blob))
    expect(bytes.getUint32(40, true)).toBe(1600 * 2)
    expect(capture.media).toHaveBeenCalledTimes(2)
    expect(capture.stopTrack).toHaveBeenCalledTimes(2)
    expect(capture.close).toHaveBeenCalledTimes(2)
  })

  it('cancels while permission is pending and ignores the late grant after recording again', async () => {
    const permission = deferred<MediaStream>()
    const lateStop = vi.fn()
    const lateStream = {
      getTracks: () => [{ stop: lateStop }],
    } as unknown as MediaStream
    capture.media.mockReturnValueOnce(permission.promise)
    render(<ConversationMode />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(capture.close).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    await act(async () => permission.resolve(lateStream))
    expect(lateStop).toHaveBeenCalledOnce()
    expect(capture.stopTrack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'stopAndSend' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'cancel' })).toBeEnabled()
    expect(uploads()).toHaveLength(0)

    act(() =>
      capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples() })
    )
    fireEvent.click(screen.getByRole('button', { name: 'stopAndSend' }))
    await act(async () => capture.nodes[0]!.emit({ type: 'stopped' }))
    await screen.findByText('Hello there')
    expect(uploads()).toHaveLength(1)
  })

  it('ignores a cancelled initialization failure without disrupting the next recording', async () => {
    const module = deferred<void>()
    capture.addModule.mockReturnValueOnce(module.promise)
    render(<ConversationMode />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.addModule).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    await act(async () => module.reject(new Error('cancelled module load')))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'stopAndSend' })).toBeEnabled()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(capture.stopTrack).toHaveBeenCalledTimes(2)
    expect(uploads()).toHaveLength(0)
  })

  it('preserves previous messages and restores their playback after cancelling', async () => {
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    await screen.findByRole('button', { name: 'pause' })
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(2))
    screen
      .getAllByRole('button', { name: 'play' })
      .forEach((button) => expect(button).toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(createUrl).toHaveBeenCalledTimes(2)
    expect(revokeUrl).not.toHaveBeenCalled()
    const players = screen.getAllByRole('button', { name: 'play' })
    expect(players).toHaveLength(2)
    players.forEach((button) => expect(button).toBeEnabled())
    fireEvent.click(players[0]!)
    await screen.findByRole('button', { name: 'pause' })
    expect(play).toHaveBeenCalledTimes(2)
    expect(uploads()).toHaveLength(1)
  })

  it('permits exactly two manual STT retries using the stable UUID and byte-identical audio', async () => {
    result = {
      ...complete,
      user_text: null,
      assistant_text: null,
      assistant_audio_url: null,
      status: 'stt_failed',
    }
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    await screen.findByText('transcriptionFailed')
    expect(uploads()).toHaveLength(1)
    result.stt_attempts = 2
    fireEvent.click(screen.getByRole('button', { name: /retry ·/ }))
    await waitFor(() => expect(uploads()).toHaveLength(2))
    await screen.findByRole('button', { name: /retry ·/ })
    result.stt_attempts = 3
    fireEvent.click(screen.getByRole('button', { name: /retry ·/ }))
    await screen.findByText('retryLimit')
    expect(screen.queryByRole('button', { name: /retry ·/ })).toBeNull()
    const forms = uploads().map((call) => call[1].body as FormData)
    const bytes = await Promise.all(
      forms.map((form) => blobBytes(form.get('audio') as Blob))
    )
    expect(new Uint8Array(bytes[1]!)).toEqual(new Uint8Array(bytes[0]!))
    expect(new Uint8Array(bytes[2]!)).toEqual(new Uint8Array(bytes[0]!))
    expect(new Set(forms.map((form) => form.get('client_turn_id'))).size).toBe(
      1
    )
    expect(forms.map((form) => form.get('retry'))).toEqual([
      'false',
      'true',
      'true',
    ])
    expect(uploads()).toHaveLength(3)
  })

  it.each(['llm_failed', 'tts_failed'] as const)(
    'retains transcripts without an STT retry for %s',
    async (status) => {
      result = { ...complete, status, assistant_audio_url: null }
      render(<ConversationMode />)
      await start()
      await recordAndStop()
      expect(await screen.findByText('replyFailed')).toBeInTheDocument()
      expect(screen.getByText('Hello there')).toBeInTheDocument()
      expect(screen.getByText('Welcome back')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /retry ·/ })).toBeNull()
    }
  )

  it('shows localized autoplay fallback and stops playback on record', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    expect(await screen.findByText('playbackBlocked')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'play' })[1]!)
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
    pause.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    expect(pause).toHaveBeenCalled()
  })

  it('ends separately, revokes all URLs, retains text and closes best-effort', async () => {
    mocks.review.mockReturnValue(true)
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    await screen.findByText('Welcome back')
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    expect(revokeUrl).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'play' })).toBeNull()
    expect(screen.getByText('reviewPrompt')).toBeInTheDocument()
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        headers: { Authorization: 'Bearer token' },
        credentials: 'omit',
      })
    )
  })

  it('stops a late microphone grant after end and never uploads', async () => {
    const permission = deferred<MediaStream>()
    capture.media.mockReturnValue(permission.promise)
    render(<ConversationMode />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    await act(async () => permission.resolve(capture.stream))
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.nodes).toHaveLength(0)
    expect(uploads()).toHaveLength(0)
  })

  it('aborts start on unmount and closes an ID delivered despite cancellation', async () => {
    const pending = deferred<ReturnType<typeof response>>()
    mocks.api.mockImplementation((url: string) =>
      url === '/api/conversation/sessions'
        ? pending.promise
        : Promise.resolve(response(null))
    )
    const view = render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const signal = mocks.api.mock.calls.find(
      ([url]) => url === '/api/conversation/sessions'
    )?.[1].signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(response(session)))
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
    )
    expect(
      mocks.api.mock.calls.some(([url]) => String(url).endsWith('/greeting'))
    ).toBe(false)
  })

  it('discards pending turn data on a language switch and releases capture on account switch', async () => {
    const view = render(<ConversationMode targetLanguage="es" />)
    await start()
    const pending = deferred<ReturnType<typeof response>>()
    mocks.api.mockImplementation((url: string) =>
      url.endsWith('/turns')
        ? pending.promise
        : Promise.resolve(response({ ...session, remaining_seconds: 600 }))
    )
    await recordAndStop()
    view.rerender(<ConversationMode targetLanguage="ja" />)
    await act(async () => pending.resolve(response(complete)))
    expect(screen.queryByText('Welcome back')).toBeNull()
    expect(revokeUrl).toHaveBeenCalledOnce()
  })

  it('ignores assistant audio delivered after unmount and aborts its authenticated fetch', async () => {
    const pending = deferred<{ ok: boolean; blob: () => Promise<Blob> }>()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.includes('/audio/') ? pending.promise : original(url, options)
    )
    const view = render(<ConversationMode />)
    await start()
    await recordAndStop()
    await waitFor(() =>
      expect(
        mocks.api.mock.calls.some(([url]) => String(url).includes('/audio/'))
      ).toBe(true)
    )
    const signal = mocks.api.mock.calls.find(([url]) =>
      String(url).includes('/audio/')
    )?.[1].signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () =>
      pending.resolve({
        ok: true,
        blob: async () => new Blob([float32ToWav(generatedSamples(), 16000)]),
      })
    )
    expect(createUrl).toHaveBeenCalledOnce()
    expect(revokeUrl).toHaveBeenCalledOnce()
    expect(play).not.toHaveBeenCalled()
  })

  it('keeps assistant text visible when its authenticated audio fetch expires', async () => {
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.includes('/audio/')
        ? Promise.resolve(response({ detail: 'audio_not_found' }, 404))
        : original(url, options)
    )
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    expect(await screen.findByText('audioExpired')).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })

  it('ignores a stale activity 410 after a new session starts', async () => {
    const pending = deferred<ReturnType<typeof response>>()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/activity') ? pending.promise : original(url, options)
    )
    render(<ConversationMode />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    fireEvent.click(screen.getByRole('button', { name: 'startNew' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    await act(async () =>
      pending.resolve(response({ detail: 'session_expired' }, 410))
    )
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    expect(screen.queryByText('sessionExpired')).toBeNull()
    expect(closeFetch).toHaveBeenCalledTimes(1)
  })

  it('fatal activity error during playback pauses and detaches all players, revokes audio and retains text', async () => {
    const view = render(<ConversationMode />)
    await start()
    await recordAndStop()
    await screen.findByRole('button', { name: 'pause' })
    const audios = Array.from(view.container.querySelectorAll('audio'))
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url.endsWith('/activity')
        ? Promise.resolve(response({ detail: 'session_expired' }, 410))
        : original(url, options)
    )
    pause.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('sessionExpired')
    expect(pause).toHaveBeenCalled()
    expect(revokeUrl).toHaveBeenCalledTimes(2)
    expect(view.container.querySelectorAll('audio')).toHaveLength(0)
    audios.forEach((audio) => expect(audio.getAttribute('src')).toBeNull())
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'startNew' })).toBeInTheDocument()
    const signal = mocks.api.mock.calls.find(([url]) =>
      String(url).endsWith('/turns')
    )?.[1].signal as AbortSignal
    expect(signal.aborted).toBe(true)
  })

  it('localizes HTTP gate errors rather than displaying provider detail', async () => {
    mocks.api.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/conversation/sessions'
          ? response({ detail: 'voice_services_unavailable' }, 503)
          : response(null)
      )
    )
    render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'errorVoiceServicesUnavailable'
    )
    expect(capture.media).not.toHaveBeenCalled()
  })

  it('checks the backend deadline before expiring a slow provider turn and preserves its response', async () => {
    const now = Date.now()
    const nearExpiry = new Date(now + 1500).toISOString()
    const extended = new Date(now + 180_000).toISOString()
    const turn = deferred<ReturnType<typeof response>>()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) => {
      if (url === '/api/conversation/sessions')
        return Promise.resolve(
          response({ ...session, inactivity_expires_at: nearExpiry })
        )
      if (url.endsWith('/greeting'))
        return Promise.resolve(
          response({ ...greeting, inactivity_expires_at: nearExpiry })
        )
      if (url.endsWith('/turns')) return turn.promise
      if (url.endsWith('/activity'))
        return Promise.resolve(
          response({
            ...session,
            inactivity_expires_at: nearExpiry,
            remaining_seconds: 600,
          })
        )
      if (url === '/api/conversation/sessions/session-1')
        return Promise.resolve(
          response({
            ...session,
            inactivity_expires_at: extended,
            remaining_seconds: 300,
          })
        )
      return original(url, options)
    })
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    expect(uploads()).toHaveLength(1)
    expect(screen.getByText('processing')).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          mocks.api.mock.calls.some(
            ([url]) => url === '/api/conversation/sessions/session-1'
          )
        ).toBe(true),
      { timeout: 3000 }
    )
    expect(screen.queryByText('sessionExpired')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'endSession' })
    ).toBeInTheDocument()
    await act(async () =>
      turn.resolve(response({ ...complete, inactivity_expires_at: extended }))
    )
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.queryByText('sessionExpired')).toBeNull()
  })

  it('does not shorten the absolute deadline when a slow provider response reports rounded remaining seconds', async () => {
    const startAt = Date.now()
    const absolute = new Date(startAt + 5000).toISOString()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) => {
      if (url === '/api/conversation/sessions')
        return Promise.resolve(response({ ...session, expires_at: absolute }))
      if (url.endsWith('/greeting'))
        return Promise.resolve(response({ ...greeting, remaining_seconds: 1 }))
      return original(url, options)
    })
    render(<ConversationMode />)
    await start()
    // The greeting's rounded remaining_seconds must not replace expires_at
    // with a new deadline derived from the response arrival time.
    await new Promise((resolve) => setTimeout(resolve, 1300))
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    expect(screen.queryByText('sessionExpired')).toBeNull()
  })

  it('uses the latest same-owner token for closing and ignores a delayed failed close', async () => {
    render(<ConversationMode />)
    await start()
    act(() => useAuthStore.setState({ accessToken: 'refreshed-token' }))
    const close = deferred<{
      ok: boolean
      status: number
      json: () => Promise<unknown>
    }>()
    closeFetch.mockReturnValueOnce(close.promise)
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({
        headers: { Authorization: 'Bearer refreshed-token' },
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'startNew' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    await act(async () =>
      close.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'unauthorized' }),
      })
    )
    expect(useAuthStore.getState().accessToken).toBe('refreshed-token')
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps a pending provider turn busy if an expiry read temporarily fails', async () => {
    const turn = deferred<ReturnType<typeof response>>()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith('/turns')) return turn.promise
      if (url === '/api/conversation/sessions/session-1')
        return Promise.reject(new TypeError('network unavailable'))
      return original(url, options)
    })
    render(<ConversationMode />)
    await start()
    await recordAndStop()
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'errorConnection'
    )
    expect(screen.getByRole('button', { name: 'record' })).toBeDisabled()
    expect(closeFetch).not.toHaveBeenCalled()
    await act(async () => turn.resolve(response(complete)))
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
  })

  it('does not overlap expiry checks and ignores a stale expiry response after restarting', async () => {
    const original = mocks.api.getMockImplementation()!
    const check = deferred<ReturnType<typeof response>>()
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url === '/api/conversation/sessions/session-1'
        ? check.promise
        : original(url, options)
    )
    render(<ConversationMode />)
    await start()
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(
      mocks.api.mock.calls.filter(
        ([url]) => url === '/api/conversation/sessions/session-1'
      )
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    fireEvent.click(screen.getByRole('button', { name: 'startNew' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    await act(async () =>
      check.resolve(response({ detail: 'session_expired' }, 410))
    )
    expect(screen.queryByText('sessionExpired')).toBeNull()
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
  })

  it('expires at the absolute deadline even if the backend has extended inactivity', async () => {
    const now = Date.now()
    const soon = new Date(now + 1000).toISOString()
    const later = new Date(now + 180_000).toISOString()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) => {
      if (url === '/api/conversation/sessions')
        return Promise.resolve(
          response({
            ...session,
            expires_at: soon,
            inactivity_expires_at: later,
          })
        )
      if (url.endsWith('/greeting'))
        return Promise.resolve(
          response({ ...greeting, inactivity_expires_at: later })
        )
      return original(url, options)
    })
    render(<ConversationMode />)
    await start()
    expect(
      await screen.findByText('sessionExpired', {}, { timeout: 3000 })
    ).toBeInTheDocument()
    expect(
      mocks.api.mock.calls.some(
        ([url]) => url === '/api/conversation/sessions/session-1'
      )
    ).toBe(false)
  })

  it('expires on the server deadline without a polling activity heartbeat', async () => {
    mocks.api.mockImplementation(async (url: string) => {
      if (url === '/api/conversation/sessions')
        return response({
          ...session,
          inactivity_expires_at: new Date(Date.now() - 1000).toISOString(),
        })
      if (url.endsWith('/greeting'))
        return response({
          ...greeting,
          inactivity_expires_at: new Date(Date.now() - 1000).toISOString(),
        })
      if (url === '/api/conversation/sessions/session-1')
        return response({ detail: 'session_expired' }, 410)
      return response(null)
    })
    render(<ConversationMode />)
    await start()
    expect(
      await screen.findByText('sessionExpired', {}, { timeout: 3000 })
    ).toBeInTheDocument()
    expect(
      mocks.api.mock.calls.some(([url]) => String(url).endsWith('/activity'))
    ).toBe(false)
    expect(screen.getByRole('button', { name: 'startNew' })).toBeInTheDocument()
  })

  it('closes a late session start with its original owner token after an account switch', async () => {
    const pending = deferred<ReturnType<typeof response>>()
    const original = mocks.api.getMockImplementation()!
    mocks.api.mockImplementation((url: string, options: RequestInit) =>
      url === '/api/conversation/sessions'
        ? pending.promise
        : original(url, options)
    )
    render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    act(() =>
      useAuthStore.setState({
        accessToken: 'new-account-token',
        user: {
          id: 2,
          username: 'other',
          displayName: 'Other',
          role: 'user',
          conversation_max_duration: 1800,
          conversation_inactivity_timeout: 180,
        },
      })
    )
    await act(async () => pending.resolve(response(session)))
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
    )
    expect(
      mocks.api.mock.calls.some(([url]) => String(url).endsWith('/greeting'))
    ).toBe(false)
  })

  it('closes the former owner session after logout and does not send their token to the new account', async () => {
    const owner = {
      id: 1,
      username: 'owner',
      displayName: 'Owner',
      role: 'user' as const,
      conversation_max_duration: 1800,
      conversation_inactivity_timeout: 180,
    }
    useAuthStore.setState({ user: owner, accessToken: 'owner-token' })
    render(<ConversationMode />)
    await start()
    act(() => useAuthStore.getState().logout())
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({
        headers: { Authorization: 'Bearer owner-token' },
        credentials: 'omit',
      })
    )
    closeFetch.mockClear()
    act(() =>
      useAuthStore.setState({ user: owner, accessToken: 'owner-token' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
    )
    act(() =>
      useAuthStore.setState({
        user: { ...owner, id: 2, username: 'other' },
        accessToken: 'other-token',
      })
    )
    expect(closeFetch).toHaveBeenCalledWith(
      '/api/conversation/sessions/session-1/close',
      expect.objectContaining({
        headers: { Authorization: 'Bearer owner-token' },
        credentials: 'omit',
      })
    )
    expect(closeFetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: { Authorization: 'Bearer other-token' },
      })
    )
  })

  it('clears recording UI and releases capture when the account changes', async () => {
    render(<ConversationMode />)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    act(() =>
      useAuthStore.setState({
        user: {
          id: 2,
          username: 'other',
          displayName: 'Other',
          role: 'user',
          conversation_max_duration: 1800,
          conversation_inactivity_timeout: 180,
        },
      })
    )
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'stopAndSend' })).toBeNull()
    expect(screen.getByRole('button', { name: 'start' })).toBeInTheDocument()
    expect(uploads()).toHaveLength(0)
  })

  it('preserves freemium/trial UI and finite quota details', async () => {
    mocks.api.mockImplementation(async () =>
      response({
        sessions_this_week: 3,
        sessions_limit: 3,
        sessions_unlimited: false,
        minutes_today: 12,
        minutes_limit: 30,
        time_unlimited: false,
        tokens_unlimited: true,
      })
    )
    const view = render(<ConversationMode />)
    fireEvent.click(await screen.findByRole('button', { name: /3\/3 ses/ }))
    expect(screen.getByText('quotaSessions')).toBeInTheDocument()
    expect(screen.getByText('quotaMinutes')).toBeInTheDocument()
    view.rerender(
      <ConversationMode freemiumVoiceRemaining={0} freemiumVoiceLimit={10} />
    )
    expect(screen.getByText('freemiumVoiceRemaining')).toHaveClass(
      'text-red-500'
    )
  })
})
