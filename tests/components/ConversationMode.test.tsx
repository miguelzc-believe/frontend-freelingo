import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealTimeVADOptions } from '@ricky0123/vad-web'

const mocks = vi.hoisted(() => ({
  options: {} as Partial<RealTimeVADOptions>,
  create: vi.fn(),
  start: vi.fn(),
  destroy: vi.fn(),
  startedStream: null as MediaStream | null,
  getUserMedia: vi.fn(),
  apiFetch: vi.fn(),
  enqueue: vi.fn(),
  cancel: vi.fn(),
  closeAudio: vi.fn(),
}))

vi.mock('@ricky0123/vad-web', () => ({
  MicVAD: {
    new: (options: Partial<RealTimeVADOptions>) => mocks.create(options),
  },
}))
vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { raw: () => [] }),
}))
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/lib/audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audio')>()),
  createAudioQueue: () => ({ enqueue: mocks.enqueue, cancel: mocks.cancel }),
}))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: () => null,
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowVoiceReviewPrompt: () => false,
}))
vi.mock('@/components/conversation/StatusIndicator', () => ({
  default: ({ userSpeaking }: { userSpeaking: boolean }) => (
    <div data-testid="speaking">{String(userSpeaking)}</div>
  ),
}))

import ConversationMode from '@/components/conversation/ConversationMode'
import { useAuthStore } from '@/store/auth'

class MockWebSocket {
  static OPEN = 1
  static instances: MockWebSocket[] = []
  readyState = 1
  binaryType = ''
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = 3
  })

  constructor() {
    MockWebSocket.instances.push(this)
  }

  message(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

function microphone() {
  const stop = vi.fn()
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  }
}

async function start(label = 'start') {
  const count = MockWebSocket.instances.length
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(MockWebSocket.instances).toHaveLength(count + 1))
  const ws = MockWebSocket.instances[count]
  act(() => ws!.onopen?.())
  ws!.send.mockClear()
  return ws
}

function speak() {
  mocks.options.onSpeechStart?.()
  mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.05))
}

beforeEach(() => {
  vi.clearAllMocks()
  MockWebSocket.instances = []
  mocks.startedStream = null
  mocks.getUserMedia.mockReset().mockResolvedValue(microphone().stream)
  mocks.create.mockImplementation(async (options) => {
    mocks.options = options
    return { start: mocks.start, destroy: mocks.destroy }
  })
  mocks.start.mockImplementation(async () => {
    mocks.startedStream = (await mocks.options.getStream?.()) ?? null
  })
  mocks.destroy.mockResolvedValue(undefined)
  mocks.closeAudio.mockResolvedValue(undefined)
  mocks.enqueue.mockResolvedValue(undefined)
  mocks.apiFetch.mockResolvedValue({ ok: true, json: async () => null })
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running'
      close = mocks.closeAudio
    }
  )
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: mocks.getUserMedia },
  })
  Element.prototype.scrollIntoView = vi.fn()
  useAuthStore.setState({ accessToken: 'token', user: null })
  localStorage.removeItem('tts_voice')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ConversationMode session lifecycle', () => {
  it('does not request the microphone or create VAD until start is pressed', () => {
    render(<ConversationMode />)

    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('retries denied permission without poisoning VAD', async () => {
    mocks.getUserMedia.mockRejectedValueOnce(
      new DOMException('Denied', 'NotAllowedError')
    )
    render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await screen.findByText(/errorMic/)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    await start('startNew')
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(mocks.startedStream).not.toBeNull()
  })

  it('shows a localized message when a local voice service is unavailable', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ detail: 'voice_services_unavailable' }),
          })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))

    expect(
      await screen.findByText('✕ errorVoiceServicesUnavailable')
    ).toBeInTheDocument()
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('stops a microphone granted after unmount without starting VAD or WS', async () => {
    const mic = microphone()
    let grant!: (stream: MediaStream) => void
    mocks.getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      })
    )
    const view = render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    view.unmount()
    await act(async () => {
      grant(mic.stream)
    })
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('releases the VAD instance and microphone when the session ends', async () => {
    const mic = microphone()
    mocks.getUserMedia.mockResolvedValueOnce(mic.stream)
    render(<ConversationMode />)
    const ws = await start()

    fireEvent.click(screen.getByRole('button', { name: 'stop' }))

    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledTimes(1))
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(ws!.close).toHaveBeenCalledTimes(1)
    expect(mocks.closeAudio).toHaveBeenCalledTimes(1)
  })

  it.each(['json', 'onerror', 'onclose'])(
    'cleans up %s once and ignores obsolete callbacks after restart',
    async (kind) => {
      const mic = microphone()
      mocks.getUserMedia.mockResolvedValueOnce(mic.stream)
      render(<ConversationMode />)
      const ws = await start()
      const oldOpen = ws!.onopen!
      const oldMessage = ws!.onmessage!
      const oldError = ws!.onerror!
      const oldClose = ws!.onclose!
      act(() => {
        if (kind === 'json')
          ws!.message({ type: 'error', code: 'unauthorized' })
        else if (kind === 'onerror') oldError()
        else oldClose({ code: 1006, reason: '' })
        oldError()
        oldClose({ code: 1006, reason: '' })
      })
      await waitFor(() => expect(mocks.destroy).toHaveBeenCalledTimes(1))
      expect(mic.stop).toHaveBeenCalledTimes(1)
      expect(mocks.closeAudio).toHaveBeenCalledTimes(1)
      expect(ws!.close).toHaveBeenCalledTimes(1)
      const current = await start('startNew')
      act(() => {
        oldOpen()
        oldMessage({
          data: JSON.stringify({ type: 'session_end', reason: 'inactivity' }),
        })
        oldError()
        oldClose({ code: 1006, reason: '' })
      })
      expect(current!.close).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'stop' })).toBeDefined()
    }
  )

  it.each([
    { type: 'status', value: 'listening' },
    { type: 'turn_complete' },
    ...['stt_failed', 'llm_failed', 'tts_failed'].map((code) => ({
      type: 'error',
      code,
    })),
  ])(
    'blocks immediately and releases on $type $value $code',
    async (outcome) => {
      render(<ConversationMode />)
      const ws = await start()
      act(() => {
        speak()
        speak()
      })
      expect(ws!.send).toHaveBeenCalledTimes(1)
      act(() => ws!.message({ type: 'status', value: 'transcribing' }))
      act(() => speak())
      expect(ws!.send).toHaveBeenCalledTimes(1)
      act(() => ws!.message(outcome))
      expect(screen.getByRole('button', { name: 'stop' })).toBeDefined()
      act(() => speak())
      expect(ws!.send).toHaveBeenCalledTimes(2)
      expect(ws!.close).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['stt_failed', 'errorTranscription'],
    ['llm_failed', 'errorResponse'],
    ['tts_failed', 'errorSpeech'],
    ['auth_failed', 'errorUnauthorized'],
    ['services_disabled', 'errorServicesDisabled'],
    ['quota_exceeded_sessions', 'quotaExceededSessions'],
    ['quota_exceeded_time', 'quotaExceededTime'],
    ['quota_exceeded_tokens', 'quotaExceededTokens'],
    ['no_active_plan', 'noActivePlan'],
    ['unknown_server_error', 'errorMessage'],
  ])(
    'localizes %s without displaying the backend message',
    async (code, key) => {
      render(<ConversationMode />)
      const ws = await start()

      act(() =>
        ws!.message({
          type: 'error',
          code,
          message: 'Untranslated backend failure',
        })
      )

      expect(screen.getByText(new RegExp(key))).toBeInTheDocument()
      expect(screen.queryByText(/Untranslated backend failure/)).toBeNull()
    }
  )

  it.each(['onerror', 'onclose'])(
    'localizes %s without displaying transport diagnostics',
    async (event) => {
      render(<ConversationMode />)
      const ws = await start()

      act(() => {
        if (event === 'onerror') ws!.onerror?.()
        else ws!.onclose?.({ code: 1011, reason: 'Untranslated close reason' })
      })

      expect(screen.getByText('✕ errorConnection')).toBeInTheDocument()
      expect(
        screen.queryByText(/Untranslated close reason|\[onerror|\[code/)
      ).toBeNull()
    }
  )

  it('clears visual speech and discards the unfinished segment on misfire', async () => {
    render(<ConversationMode />)
    const ws = await start()
    act(() => {
      mocks.options.onSpeechStart?.()
    })
    expect(screen.getByTestId('speaking').textContent).toBe('true')
    act(() => {
      mocks.options.onVADMisfire?.()
    })
    expect(screen.getByTestId('speaking').textContent).toBe('false')
    act(() => {
      mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.05))
    })
    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('ignores a Blob decoded after a new session has started', async () => {
    render(<ConversationMode />)
    const ws = await start()
    let decode!: (buffer: ArrayBuffer) => void
    const blob = new Blob()
    blob.arrayBuffer = vi.fn(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          decode = resolve
        })
    )
    act(() => ws!.onmessage?.({ data: blob }))
    act(() => ws!.onerror?.())
    const current = await start('startNew')
    await act(async () => {
      decode(new ArrayBuffer(8))
    })
    expect(mocks.enqueue).not.toHaveBeenCalled()
    expect(current!.close).not.toHaveBeenCalled()
    act(() => speak())
    expect(current!.send).toHaveBeenCalledTimes(1)
  })

  it('releases resources after a WAV send throws and allows restart', async () => {
    render(<ConversationMode />)
    const ws = await start()
    ws!.send.mockImplementationOnce(() => {
      throw new Error('Transport closed')
    })
    act(() => speak())
    expect(ws!.close).toHaveBeenCalledTimes(1)
    const current = await start('startNew')
    act(() => speak())
    expect(current!.send).toHaveBeenCalledTimes(1)
  })

  it.each(['creation', 'start'])(
    'reports VAD %s failures, releases the microphone, and allows retry',
    async (failure) => {
      const mic = microphone()
      mocks.getUserMedia.mockResolvedValue(mic.stream)
      if (failure === 'creation') {
        mocks.create.mockRejectedValueOnce(new Error('VAD unavailable'))
      } else {
        mocks.start.mockRejectedValueOnce(new Error('VAD failed to start'))
      }
      render(<ConversationMode />)

      fireEvent.click(screen.getByRole('button', { name: 'start' }))
      expect(await screen.findByText('✕ errorVadInit')).toBeInTheDocument()
      expect(mic.stop).toHaveBeenCalledTimes(1)
      expect(MockWebSocket.instances).toHaveLength(0)

      await start('startNew')
      expect(MockWebSocket.instances).toHaveLength(1)
    }
  )

  it('reports a rejected warmup and does not open the websocket', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? Promise.reject(new Error('network failure'))
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))

    expect(
      await screen.findByText('✕ errorConnection [warmup request failed]')
    ).toBeInTheDocument()
    expect(MockWebSocket.instances).toHaveLength(0)
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })

  it('uses trial credentials and the selected voice in the websocket auth payload', async () => {
    localStorage.setItem('tts_voice', 'voice-test')
    render(
      <ConversationMode targetLanguage="ja" voiceTrialToken="trial-token" />
    )
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    const ws = MockWebSocket.instances[0]
    act(() => ws!.onopen?.())

    expect(ws!.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'auth',
        token: 'token',
        voice: 'voice-test',
        target_language: 'ja',
        voice_trial_token: 'trial-token',
      })
    )
    localStorage.removeItem('tts_voice')
  })

  it('renders user, streaming assistant, and finalized assistant transcript transitions', async () => {
    render(<ConversationMode targetLanguage="ja" />)
    const ws = await start()

    act(() => {
      ws!.message({
        type: 'transcript',
        role: 'user',
        text: 'こんにちは',
        final: true,
      })
      ws!.message({
        type: 'transcript',
        role: 'assistant',
        text: 'Streaming reply',
        final: false,
      })
    })
    expect(screen.getByText('こんにちは')).toBeInTheDocument()
    expect(screen.getByText('Streaming reply')).toBeInTheDocument()

    act(() =>
      ws!.message({
        type: 'transcript',
        role: 'assistant',
        text: 'Final reply',
        final: true,
      })
    )
    expect(screen.getByText('Final reply')).toBeInTheDocument()
    expect(screen.queryByText('Streaming reply')).toBeNull()
  })

  it('queues binary audio, reflects playback state, and clears playback on barge-in', async () => {
    render(<ConversationMode />)
    const ws = await start()

    const audioChunk = new ArrayBuffer(12)
    act(() => ws!.onmessage?.({ data: audioChunk }))
    expect(mocks.enqueue).toHaveBeenCalledWith(audioChunk)

    act(() => ws!.message({ type: 'barge_in' }))
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'stop' })).toBeInTheDocument()
  })

  it('shows session warnings and releases resources when the server ends a session', async () => {
    const mic = microphone()
    mocks.getUserMedia.mockResolvedValue(mic.stream)
    render(<ConversationMode />)
    const ws = await start()

    act(() => ws!.message({ type: 'session_warning', remaining_seconds: 45 }))
    expect(screen.getByText('warningTimeout')).toBeInTheDocument()

    act(() => ws!.message({ type: 'session_end', reason: 'max_duration' }))
    expect(screen.getByText('sessionEnded')).toBeInTheDocument()
    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledTimes(1))
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(ws!.close).toHaveBeenCalledTimes(1)
  })

  it('expands finite quota details and omits unlimited token usage', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url === '/api/auth/quota'
            ? {
                sessions_this_week: 3,
                sessions_limit: 3,
                sessions_unlimited: false,
                minutes_today: 12,
                minutes_limit: 30,
                time_unlimited: false,
                minutes_this_week: 12,
                weekly_minutes_limit: 90,
                weekly_minutes_unlimited: false,
                tokens_unlimited: true,
              }
            : null,
      })
    )
    render(<ConversationMode />)

    await screen.findByRole('button', { name: /3\/3 ses/ })
    fireEvent.click(screen.getByRole('button', { name: /3\/3 ses/ }))

    expect(screen.getByText('quotaSessions')).toBeInTheDocument()
    expect(screen.getByText('quotaMinutes')).toBeInTheDocument()
    expect(screen.queryByText('quotaTokens')).toBeNull()
  })

  it('uses the unauthorized close message for policy close codes', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => ws!.onclose?.({ code: 1008, reason: 'private diagnostic' }))

    expect(screen.getByText('✕ errorUnauthorized')).toBeInTheDocument()
    expect(screen.queryByText(/private diagnostic/)).toBeNull()
    expect(ws!.close).toHaveBeenCalledTimes(1)
  })
})
