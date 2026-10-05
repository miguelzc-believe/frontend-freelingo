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
  push: vi.fn(),
  starters: [] as string[],
}))

vi.mock('@ricky0123/vad-web', () => ({
  MicVAD: {
    new: (options: Partial<RealTimeVADOptions>) => mocks.create(options),
  },
}))
vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => mocks.starters }),
}))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))
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
import { useConfigStore } from '@/store/config'

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'location'
)

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
  mocks.starters = []
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
  if (originalLocationDescriptor)
    Object.defineProperty(window, 'location', originalLocationDescriptor)
})

describe('ConversationMode session lifecycle', () => {
  it('shows the first six translated starters in a stable alphabetical order', () => {
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

    const starterButtons = screen
      .getByText('startersHint')
      .parentElement?.querySelectorAll('button')
    expect(
      Array.from(starterButtons ?? [], (button) => button.textContent)
    ).toEqual(['Alpha', 'Bravo', 'Charlie', 'Xray', 'Yankee', 'Zulu'])
  })

  it('does not request the microphone or create VAD until start is pressed', () => {
    render(<ConversationMode />)

    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('auto-starts when opened from the chat overlay', async () => {
    render(<ConversationMode autoStart />)

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    expect(mocks.getUserMedia).toHaveBeenCalledTimes(1)
    act(() => MockWebSocket.instances[0]!.onopen?.())
    expect(screen.getByRole('button', { name: 'stop' })).toBeInTheDocument()
  })

  it('does not acquire resources when started without an access token', () => {
    useAuthStore.setState({ accessToken: null, user: null })
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))

    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(
      mocks.apiFetch.mock.calls.some(
        ([url]) => url === '/api/conversation/warmup'
      )
    ).toBe(false)
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('reports AudioContext construction failure without acquiring other resources', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('AudioContext unavailable')
        }
      }
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))

    expect(await screen.findByText('✕ errorConnection')).toBeInTheDocument()
    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(
      mocks.apiFetch.mock.calls.some(
        ([url]) => url === '/api/conversation/warmup'
      )
    ).toBe(false)
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('constructs AudioContext synchronously in the start action before pending resume', async () => {
    let finishResume!: () => void
    const resume = new Promise<void>((resolve) => {
      finishResume = resolve
    })
    const construct = vi.fn(function () {
      return {
        state: 'suspended',
        resume: () => resume,
        close: mocks.closeAudio,
      }
    })
    vi.stubGlobal('AudioContext', construct)
    render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(construct).toHaveBeenCalledOnce()
    expect(mocks.getUserMedia).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    await act(async () => finishResume())
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    expect(mocks.getUserMedia).toHaveBeenCalledOnce()
  })

  it('continues starting after a suspended audio context cannot resume', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'suspended'
        resume = vi.fn().mockRejectedValue(new Error('resume denied'))
        close = mocks.closeAudio
      }
    )
    render(<ConversationMode />)

    const ws = await start()

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(ws!.close).not.toHaveBeenCalled()
  })

  it('disables another start while warmup is pending', async () => {
    let finishWarmup!: (response: {
      ok: boolean
      json: () => Promise<{ detail?: string }>
    }) => void
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? new Promise((resolve) => {
            finishWarmup = resolve
          })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const warming = await screen.findByRole('button', { name: 'statusWarming' })
    expect(warming).toBeDisabled()
    fireEvent.click(warming)

    expect(mocks.getUserMedia).toHaveBeenCalledTimes(1)
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([url]) => url === '/api/conversation/warmup'
      )
    ).toHaveLength(1)
    await act(async () => finishWarmup({ ok: false, json: async () => ({}) }))
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

  it('ignores malformed text frames without interrupting the live session', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => ws!.onmessage?.({ data: '{invalid json' }))

    expect(screen.getByRole('button', { name: 'stop' })).toBeInTheDocument()
    expect(screen.queryByText('errorMessage')).not.toBeInTheDocument()
  })

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

  it('clears speaking and sends nothing when VAD ends with empty audio', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => mocks.options.onSpeechStart?.())
    expect(screen.getByTestId('speaking').textContent).toBe('true')
    act(() => mocks.options.onSpeechEnd?.(new Float32Array()))

    expect(screen.getByTestId('speaking').textContent).toBe('false')
    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('discards short high-volume audio that does not meet the speech duration', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => {
      mocks.options.onSpeechStart?.()
      mocks.options.onSpeechEnd?.(new Float32Array(8000).fill(0.2))
    })

    expect(screen.getByTestId('speaking').textContent).toBe('false')
    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('does not send speech when the websocket is no longer open', async () => {
    render(<ConversationMode />)
    const ws = await start()
    ws!.readyState = 3

    act(() => {
      mocks.options.onSpeechStart?.()
      mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.05))
    })

    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('discards a full-length short-noise segment without sending it', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => {
      mocks.options.onSpeechStart?.()
      mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.005))
    })

    expect(screen.getByTestId('speaking').textContent).toBe('false')
    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('ignores an utterance that ends after the server ends the session', async () => {
    render(<ConversationMode />)
    const ws = await start()
    act(() => ws!.message({ type: 'session_end', reason: 'inactivity' }))
    await waitFor(() => expect(mocks.destroy).toHaveBeenCalledTimes(1))
    ws!.send.mockClear()

    act(() => {
      mocks.options.onSpeechStart?.()
      mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.05))
    })

    expect(screen.getByTestId('speaking').textContent).toBe('false')
    expect(ws!.send).not.toHaveBeenCalled()
  })

  it('ignores low-RMS microphone leakage while the assistant is speaking', async () => {
    render(<ConversationMode />)
    const ws = await start()
    act(() => ws!.message({ type: 'status', value: 'speaking' }))

    act(() => {
      mocks.options.onSpeechStart?.()
      mocks.options.onSpeechEnd?.(new Float32Array(24000).fill(0.02))
    })

    expect(screen.getByTestId('speaking').textContent).toBe('false')
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

  it('reports a generic non-OK warmup and releases the session without opening WS', async () => {
    const mic = microphone()
    mocks.getUserMedia.mockResolvedValueOnce(mic.stream)
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))

    expect(await screen.findByText('✕ errorConnection')).toBeInTheDocument()
    expect(MockWebSocket.instances).toHaveLength(0)
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(mocks.closeAudio).toHaveBeenCalledTimes(1)
  })

  it('rechecks auth after warmup and releases resources if the token disappears', async () => {
    const mic = microphone()
    let finishWarmup!: (response: { ok: boolean }) => void
    mocks.getUserMedia.mockResolvedValueOnce(mic.stream)
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? new Promise((resolve) => {
            finishWarmup = resolve
          })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(finishWarmup).toBeDefined())
    useAuthStore.setState({ accessToken: null, user: null })
    await act(async () => finishWarmup({ ok: true }))

    expect(await screen.findByText('✕ errorUnauthorized')).toBeInTheDocument()
    expect(MockWebSocket.instances).toHaveLength(0)
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(mocks.closeAudio).toHaveBeenCalledTimes(1)
  })

  it('authenticates with the latest token when warmup completes after refresh', async () => {
    let finishWarmup!: (response: { ok: boolean }) => void
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? new Promise((resolve) => {
            finishWarmup = resolve
          })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    render(<ConversationMode />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(finishWarmup).toBeDefined())
    act(() => useAuthStore.setState({ accessToken: 'refreshed-token' }))
    await act(async () => finishWarmup({ ok: true }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    const ws = MockWebSocket.instances[0]!
    act(() => ws.onopen?.())
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'auth', token: 'refreshed-token' })
    )
  })

  it('does not connect if unmounted while warmup is pending', async () => {
    const mic = microphone()
    let finishWarmup!: (response: {
      ok: boolean
      json: () => Promise<{ detail?: string }>
    }) => void
    mocks.getUserMedia.mockResolvedValueOnce(mic.stream)
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/conversation/warmup'
        ? new Promise((resolve) => {
            finishWarmup = resolve
          })
        : Promise.resolve({ ok: true, json: async () => null })
    )
    const view = render(<ConversationMode />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(finishWarmup).toBeDefined())
    view.unmount()
    await act(async () => finishWarmup({ ok: true, json: async () => ({}) }))

    expect(MockWebSocket.instances).toHaveLength(0)
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(mocks.closeAudio).toHaveBeenCalledTimes(1)
  })

  it('sends the trial token in the warmup request body', async () => {
    render(<ConversationMode voiceTrialToken="trial-token" />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))

    const warmupCall = mocks.apiFetch.mock.calls.find(
      ([url]) => url === '/api/conversation/warmup'
    )
    expect(warmupCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trial_token: 'trial-token' }),
    })
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

  it('clears the speaking state if queued playback rejects', async () => {
    mocks.enqueue.mockRejectedValueOnce(new Error('audio decode failed'))
    render(<ConversationMode />)
    const ws = await start()

    act(() => ws!.onmessage?.({ data: new ArrayBuffer(12) }))
    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1))
    expect(mocks.enqueue).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'stop' })).toBeInTheDocument()
  })

  it('maps a policy websocket close to the unauthorized message', async () => {
    render(<ConversationMode />)
    const ws = await start()

    act(() => ws!.onclose?.({ code: 1008, reason: 'private details' }))

    expect(await screen.findByText('✕ errorUnauthorized')).toBeInTheDocument()
    expect(screen.queryByText('private details')).not.toBeInTheDocument()
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

  it('shows unlimited quotas as an infinite summary', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url === '/api/auth/quota'
            ? {
                sessions_this_week: 0,
                sessions_limit: 0,
                sessions_unlimited: true,
                minutes_today: 0,
                minutes_limit: 0,
                time_unlimited: true,
                minutes_this_week: 0,
                weekly_minutes_limit: 0,
                weekly_minutes_unlimited: true,
                tokens_unlimited: true,
              }
            : null,
      })
    )
    render(<ConversationMode />)

    const summary = await screen.findByRole('button', { name: /∞/ })
    fireEvent.click(summary)
    expect(screen.getByText('quotaSessions')).toBeInTheDocument()
    expect(screen.getByText('quotaMinutes')).toBeInTheDocument()
    expect(screen.queryByText('quotaTokens')).toBeNull()
    expect(screen.getAllByText('∞')).toHaveLength(2)
  })

  it('defaults missing token quota measurements to zero', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url === '/api/auth/quota'
            ? {
                sessions_this_week: 0,
                sessions_limit: 0,
                sessions_unlimited: true,
                minutes_today: 0,
                minutes_limit: 0,
                time_unlimited: true,
                tokens_unlimited: false,
              }
            : null,
      })
    )
    render(<ConversationMode />)

    const summary = await screen.findByRole('button', { name: /0k\/0k tok/ })
    fireEvent.click(summary)

    expect(screen.getByText('quotaTokens')).toBeInTheDocument()
    expect(screen.getByText('0 / 0')).toBeInTheDocument()
  })

  it('shows the freemium voice limit in red when no uses remain', () => {
    render(
      <ConversationMode freemiumVoiceRemaining={0} freemiumVoiceLimit={10} />
    )

    expect(screen.getByText('freemiumVoiceRemaining')).toHaveClass(
      'text-red-500'
    )
    expect(screen.queryByRole('button', { name: /quota/ })).toBeNull()
  })

  it('marks the quota summary exceeded and renders all finite usage bars', async () => {
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url === '/api/auth/quota'
            ? {
                sessions_this_week: 4,
                sessions_limit: 4,
                sessions_unlimited: false,
                minutes_today: 30,
                minutes_limit: 30,
                time_unlimited: false,
                minutes_this_week: 30,
                weekly_minutes_limit: 90,
                weekly_minutes_unlimited: false,
                tokens_this_month: 2500,
                tokens_monthly_limit: 2500,
                tokens_unlimited: false,
              }
            : null,
      })
    )
    render(<ConversationMode />)

    const summary = await screen.findByRole('button', {
      name: /4\/4 ses.*30\/30 min.*3k\/3k tok/,
    })
    expect(summary.className).toContain('border-fl-error/50')
    fireEvent.click(summary)

    expect(screen.getByText('quotaSessions')).toBeInTheDocument()
    expect(screen.getByText('quotaMinutes')).toBeInTheDocument()
    expect(screen.getByText('quotaTokens')).toBeInTheDocument()
    expect(screen.getAllByText(/\/4/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\/30/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\/3/).length).toBeGreaterThan(0)
  })

  it('offers billing after a trial ends and handles checkout failure, success and skip', async () => {
    const locationAssign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: locationAssign },
    })
    useConfigStore.setState({ priceMonthly: 12, priceYearly: 99 })
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/billing/checkout'
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => null }
      )
    )
    render(<ConversationMode trialMode voiceTrialDurationSeconds={80} />)
    expect(screen.getByText('trialBanner')).toBeInTheDocument()
    const ws = await start()
    act(() => ws!.message({ type: 'session_end', reason: 'trial_expired' }))

    expect(await screen.findByText('trialCtaTitle')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /planYearly/ }))
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/billing/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ plan: 'yearly' }),
        })
      )
    )
    expect(await screen.findByText('checkoutError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /planMonthly/ })).toBeEnabled()

    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/billing/checkout'
          ? {
              ok: true,
              json: async () => ({ url: 'https://billing.example/checkout' }),
            }
          : { ok: true, json: async () => null }
      )
    )
    fireEvent.click(screen.getByRole('button', { name: /planMonthly/ }))
    await waitFor(() =>
      expect(locationAssign).toHaveBeenCalledWith(
        'https://billing.example/checkout'
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'paywallSkip' }))
    expect(mocks.push).toHaveBeenCalledWith('/plan')
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
