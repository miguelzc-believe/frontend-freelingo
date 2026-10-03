import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VoiceRecorder } from '@/components/ui/VoiceRecorder'
import { float32ToWav } from '@/lib/audio'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))
vi.mock('@/lib/audio', () => ({
  float32ToWav: vi.fn(() => new ArrayBuffer(48)),
}))
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const stopTrack = vi.fn()
const stream = { getTracks: () => [{ stop: stopTrack }] }
const media = vi.fn()
const addModule = vi.fn()
const resume = vi.fn()
const close = vi.fn()
const source = { connect: vi.fn(), disconnect: vi.fn() }
let rate = 48000
let suspended = false
let nodes: MockNode[]
class MockNode {
  port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: vi.fn(),
    close: vi.fn(),
  }
  onprocessorerror: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  constructor() {
    nodes.push(this)
  }
  emit(data: unknown) {
    this.port.onmessage?.({ data })
  }
}
const renderAudio = vi.fn()
const offline = vi.fn(function (
  _channels: number,
  length: number,
  _rate: number
) {
  void _channels
  void _rate
  return {
    destination: {},
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createBufferSource: () => ({ connect: vi.fn(), start: vi.fn() }),
    startRendering: () => renderAudio(length),
  }
})
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}
function click() {
  fireEvent.click(screen.getByRole('button'))
}
function pcm(node = nodes[0]!, samples = [0.1, 0.2]) {
  node.emit({ type: 'samples', samples: new Float32Array(samples) })
}
async function finish() {
  pcm()
  click()
  await act(async () => {
    nodes[0]!.emit({ type: 'stopped' })
  })
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  nodes = []
  rate = 48000
  suspended = false
  media.mockResolvedValue(stream)
  addModule.mockResolvedValue(undefined)
  resume.mockResolvedValue(undefined)
  close.mockResolvedValue(undefined)
  renderAudio.mockImplementation((length: number) =>
    Promise.resolve({ getChannelData: () => new Float32Array(length) })
  )
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } })
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return {
        sampleRate: rate,
        state: suspended ? 'suspended' : 'running',
        audioWorklet: { addModule },
        resume,
        close,
        destination: {},
        createMediaStreamSource: () => source,
      }
    })
  )
  vi.stubGlobal('AudioWorkletNode', MockNode)
  vi.stubGlobal('OfflineAudioContext', offline)
  api.mockResolvedValue({ ok: true, json: async () => ({ text: 'hello' }) })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AudioWorklet recorder', () => {
  it('preserves idle, disabled and visual contracts', () => {
    render(
      <VoiceRecorder
        studyPlanId={42}
        onTranscription={vi.fn()}
        disabled
        className="custom"
      />
    )
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'ariaRecord'
    )
    expect(screen.getByRole('button')).toHaveClass('custom')
    click()
    expect(media).not.toHaveBeenCalled()
  })
  it('waits for FIFO final samples and ACK before cleanup or upload', async () => {
    rate = 16000
    const callback = vi.fn()
    render(<VoiceRecorder studyPlanId={42} onTranscription={callback} />)
    click()
    await settle()
    expect(addModule).toHaveBeenCalledWith('/audio/voice-recorder.worklet.js')
    pcm(nodes[0], [0.25])
    click()
    expect(screen.getByRole('button')).toHaveTextContent('processing')
    expect(nodes[0]!.port.postMessage).toHaveBeenCalledWith({ type: 'stop' })
    expect(close).not.toHaveBeenCalled()
    expect(stopTrack).not.toHaveBeenCalled()
    expect(api).not.toHaveBeenCalled()
    pcm(nodes[0], [0.5, 0.75])
    await act(async () => {
      nodes[0]!.emit({ type: 'stopped' })
    })
    expect(float32ToWav).toHaveBeenCalledWith(
      new Float32Array([0.25, 0.5, 0.75]),
      16000
    )
    expect(close).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(nodes[0]!.port.close).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledExactlyOnceWith('hello')
    const body = api.mock.calls[0]![1].body as FormData
    expect(body.get('study_plan_id')).toBe('42')
    expect((body.get('audio') as File).name).toBe('recording.wav')
    expect(body.has('language')).toBe(false)
  })
  it('times out at exactly 3000ms without truncated upload', async () => {
    render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
    click()
    await settle()
    pcm()
    click()
    await act(() => vi.advanceTimersByTimeAsync(2999))
    expect(close).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(close).toHaveBeenCalledOnce()
    expect(screen.getByRole('button')).toHaveTextContent('error')
    nodes[0]!.emit({ type: 'stopped' })
    expect(api).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.getByRole('button')).toHaveTextContent('record')
  })
  it.each([false, true])(
    'processor failure cleans up while stopping=%s',
    async (stopping) => {
      render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
      click()
      await settle()
      pcm()
      if (stopping) click()
      await act(async () => {
        nodes[0]!.onprocessorerror?.()
      })
      expect(screen.getByRole('button')).toHaveTextContent('error')
      expect(stopTrack).toHaveBeenCalledOnce()
      expect(api).not.toHaveBeenCalled()
    }
  )
  it.each([16000, 44100, 48000])(
    'resamples native %i only when needed',
    async (inputRate) => {
      rate = inputRate
      render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
      click()
      await settle()
      await finish()
      if (rate === 16000) expect(offline).not.toHaveBeenCalled()
      else
        expect(offline).toHaveBeenCalledWith(
          1,
          Math.ceil((2 * 16000) / rate),
          16000
        )
      expect(float32ToWav).toHaveBeenCalledWith(expect.any(Float32Array), 16000)
    }
  )
  it('snapshots plan and callback and awaits delivery', async () => {
    const delivery = deferred<void>()
    const original = vi.fn(() => delivery.promise)
    const replacement = vi.fn()
    const view = render(
      <VoiceRecorder studyPlanId={42} onTranscription={original} />
    )
    click()
    await settle()
    view.rerender(
      <VoiceRecorder studyPlanId={99} onTranscription={replacement} />
    )
    await finish()
    expect((api.mock.calls[0]![1].body as FormData).get('study_plan_id')).toBe(
      '42'
    )
    expect(replacement).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toHaveTextContent('processing')
    click()
    expect(media).toHaveBeenCalledOnce()
    await act(async () => {
      delivery.resolve()
    })
    expect(screen.getByRole('button')).toHaveTextContent('record')
  })
  it.each(['permission', 'module', 'resume'])(
    'cancels pending %s and ignores stale completion in a new session',
    async (step) => {
      const pending = deferred<unknown>()
      if (step === 'permission') media.mockReturnValueOnce(pending.promise)
      if (step === 'module') addModule.mockReturnValueOnce(pending.promise)
      if (step === 'resume') {
        suspended = true
        resume.mockReturnValueOnce(pending.promise)
      }
      render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
      click()
      await settle()
      click()
      expect(screen.getByRole('button')).toHaveTextContent('record')
      click()
      await settle()
      const count = nodes.length
      await act(async () => {
        pending.resolve(step === 'permission' ? stream : undefined)
      })
      expect(nodes).toHaveLength(count)
      expect(screen.getByRole('button')).toHaveTextContent('stop')
      expect(api).not.toHaveBeenCalled()
    }
  )
  it.each(['permission', 'module', 'resume'])(
    'unmount cancels pending %s',
    async (step) => {
      const pending = deferred<unknown>()
      if (step === 'permission') media.mockReturnValueOnce(pending.promise)
      if (step === 'module') addModule.mockReturnValueOnce(pending.promise)
      if (step === 'resume') {
        suspended = true
        resume.mockReturnValueOnce(pending.promise)
      }
      const view = render(
        <VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />
      )
      click()
      await settle()
      view.unmount()
      await act(async () => {
        pending.resolve(step === 'permission' ? stream : undefined)
      })
      expect(stopTrack).toHaveBeenCalledOnce()
      expect(api).not.toHaveBeenCalled()
    }
  )
  it.each(['permission', 'module', 'resume', 'constructor', 'unsupported'])(
    'fails cleanly for %s',
    async (step) => {
      if (step === 'permission') media.mockRejectedValue(new Error('denied'))
      if (step === 'module') addModule.mockRejectedValue(new Error('module'))
      if (step === 'resume') {
        suspended = true
        resume.mockRejectedValue(new Error('resume'))
      }
      if (step === 'constructor')
        vi.stubGlobal('AudioWorkletNode', function () {
          throw new Error('node')
        })
      if (step === 'unsupported') vi.stubGlobal('AudioWorkletNode', undefined)
      render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
      click()
      await settle()
      expect(screen.getByRole('button')).toHaveTextContent('error')
      expect(api).not.toHaveBeenCalled()
    }
  )
  it('resumes a suspended context before capture', async () => {
    suspended = true
    render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
    click()
    await settle()
    expect(resume).toHaveBeenCalledOnce()
    await finish()
    expect(api).toHaveBeenCalledOnce()
  })
  it.each([1, 5])(
    'auto stop at %i seconds requests ACK once',
    async (seconds) => {
      render(
        <VoiceRecorder
          studyPlanId={42}
          onTranscription={vi.fn()}
          maxSeconds={seconds}
        />
      )
      click()
      await settle()
      pcm()
      await act(() => vi.advanceTimersByTimeAsync(seconds * 1000 - 1))
      expect(nodes[0]!.port.postMessage).not.toHaveBeenCalled()
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(nodes[0]!.port.postMessage).toHaveBeenCalledOnce()
      expect(api).not.toHaveBeenCalled()
      await act(async () => {
        nodes[0]!.emit({ type: 'stopped' })
      })
      expect(api).toHaveBeenCalledOnce()
    }
  )
  it('empty capture fails only after ACK', async () => {
    render(<VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />)
    click()
    await settle()
    click()
    expect(screen.getByRole('button')).toHaveTextContent('processing')
    await act(async () => {
      nodes[0]!.emit({ type: 'stopped' })
    })
    expect(screen.getByRole('button')).toHaveTextContent('error')
    expect(api).not.toHaveBeenCalled()
  })
  it('unmount during resampling suppresses upload', async () => {
    const pending = deferred<{ getChannelData: () => Float32Array }>()
    renderAudio.mockReturnValue(pending.promise)
    const view = render(
      <VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />
    )
    click()
    await settle()
    await finish()
    view.unmount()
    await act(async () => {
      pending.resolve({ getChannelData: () => new Float32Array(1) })
    })
    expect(api).not.toHaveBeenCalled()
  })
  it('unmount while recording releases immediately without requesting a flush', async () => {
    const view = render(
      <VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />
    )
    click()
    await settle()
    pcm()
    view.unmount()
    expect(nodes[0]!.port.postMessage).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(api).not.toHaveBeenCalled()
  })
  it('unmount aborts upload and suppresses late callback', async () => {
    const response = deferred<{
      ok: boolean
      json: () => Promise<{ text: string }>
    }>()
    api.mockReturnValue(response.promise)
    const callback = vi.fn()
    const view = render(
      <VoiceRecorder studyPlanId={42} onTranscription={callback} />
    )
    click()
    await settle()
    await finish()
    view.unmount()
    expect(api.mock.calls[0]![1].signal.aborted).toBe(true)
    await act(async () => {
      response.resolve({ ok: true, json: async () => ({ text: 'late' }) })
    })
    expect(callback).not.toHaveBeenCalled()
  })
  it('unmount while awaiting ACK immediately releases without flush upload', async () => {
    const view = render(
      <VoiceRecorder studyPlanId={42} onTranscription={vi.fn()} />
    )
    click()
    await settle()
    pcm()
    click()
    view.unmount()
    expect(close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    nodes[0]!.emit({ type: 'stopped' })
    expect(api).not.toHaveBeenCalled()
  })
  it.each(['http', 'network', 'callback'])(
    'shows existing error for %s failure',
    async (failure) => {
      if (failure === 'http') api.mockResolvedValue({ ok: false, status: 500 })
      if (failure === 'network') api.mockRejectedValue(new Error('network'))
      const callback = vi.fn(() => {
        if (failure === 'callback') throw new Error('delivery')
      })
      render(<VoiceRecorder studyPlanId={42} onTranscription={callback} />)
      click()
      await settle()
      await finish()
      expect(screen.getByRole('button')).toHaveTextContent('error')
    }
  )
})
