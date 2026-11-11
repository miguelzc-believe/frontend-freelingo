import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVoiceRecording } from '@/lib/voice-recording'
import {
  blobBytes,
  captureFixture,
  deferred,
  generatedSamples,
} from '../helpers/voice-capture'

let capture: ReturnType<typeof captureFixture>
beforeEach(() => {
  capture = captureFixture()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('one-shot voice capture', () => {
  it('flushes final PCM in FIFO order and returns valid mono PCM16 WAV', async () => {
    const recording = createVoiceRecording(120, vi.fn())
    expect(capture.media).not.toHaveBeenCalled()
    await recording.start()
    const node = capture.nodes[0]!
    node.emit({ type: 'stopped' })
    node.emit({ type: 'samples', samples: generatedSamples(128) })
    const stopped = recording.stop()
    expect(recording.stop()).toBe(stopped)
    expect(capture.stopTrack).not.toHaveBeenCalled()
    node.emit({ type: 'samples', samples: generatedSamples(64) })
    node.emit({ type: 'stopped' })
    node.emit({ type: 'stopped' })
    const blob = await stopped
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(node.port.close).toHaveBeenCalledOnce()
    expect(node.disconnect).toHaveBeenCalledOnce()
    vi.useRealTimers()
    const bytes = new DataView(await blobBytes(blob!))
    expect(bytes.byteLength).toBe(44 + 192 * 2)
    expect(bytes.getUint16(20, true)).toBe(1)
    expect(bytes.getUint16(22, true)).toBe(1)
    expect(bytes.getUint32(24, true)).toBe(16000)
    expect(bytes.getUint16(34, true)).toBe(16)
    expect(bytes.getUint32(40, true)).toBe(384)
  })

  it('resamples native 48k capture with OfflineAudioContext', async () => {
    capture = captureFixture(48000)
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples(4800) })
    const stopped = recording.stop()
    capture.nodes[0]!.emit({ type: 'stopped' })
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    const blob = await stopped
    expect(capture.offline).toHaveBeenCalledWith(1, 1600, 16000)
    expect(blob!.size).toBe(44 + 1600 * 2)
  })

  it('bounds capture and triggers one stop at the server recording limit', async () => {
    const limit = vi.fn()
    const recording = createVoiceRecording(1, limit)
    await recording.start()
    capture.nodes[0]!.emit({
      type: 'samples',
      samples: generatedSamples(32000),
    })
    capture.nodes[0]!.emit({
      type: 'samples',
      samples: generatedSamples(32),
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(limit).toHaveBeenCalledOnce()
    const stopped = recording.stop()
    capture.nodes[0]!.emit({ type: 'stopped' })
    expect((await stopped)!.size).toBe(44 + 16000 * 2)
  })

  it('discards active capture and clears its automatic send timer on cancel', async () => {
    const limit = vi.fn()
    const recording = createVoiceRecording(1, limit)
    await recording.start()
    const node = capture.nodes[0]!
    node.emit({ type: 'samples', samples: generatedSamples() })
    recording.cancel()
    await vi.advanceTimersByTimeAsync(2000)
    node.emit({ type: 'stopped' })
    expect(limit).not.toHaveBeenCalled()
    expect(await recording.stop()).toBeNull()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(node.port.close).toHaveBeenCalledOnce()
    expect(capture.offline).not.toHaveBeenCalled()
  })

  it('cleans empty recording without uploadable data', async () => {
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    const stopped = recording.stop()
    const assertion = expect(stopped).rejects.toMatchObject({
      code: 'emptyRecording',
    })
    capture.nodes[0]!.emit({ type: 'stopped' })
    await assertion
    expect(capture.stopTrack).toHaveBeenCalledOnce()
  })

  it('releases native audio after a missing module, permission rejection or missing ACK', async () => {
    capture.addModule.mockRejectedValueOnce(new Error('module missing'))
    const unavailable = createVoiceRecording(120, vi.fn())
    await expect(unavailable.start()).rejects.toMatchObject({
      code: 'microphoneUnavailable',
    })
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    capture = captureFixture()
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    const assertion = expect(recording.stop()).rejects.toMatchObject({
      code: 'microphoneUnavailable',
    })
    await vi.advanceTimersByTimeAsync(3000)
    await assertion
    expect(capture.stopTrack).toHaveBeenCalledOnce()
  })

  it('reports a generic resampling failure as a microphone error', async () => {
    capture = captureFixture(48000)
    const createOffline = capture.offline.getMockImplementation()!
    capture.offline.mockImplementationOnce(function (channels, length) {
      const offline = createOffline(channels, length)
      offline.startRendering = vi
        .fn()
        .mockRejectedValue(new Error('resampling failed'))
      return offline
    })
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples(4800) })
    const stopped = recording.stop()
    capture.nodes[0]!.emit({ type: 'stopped' })

    await expect(stopped).rejects.toMatchObject({
      code: 'microphoneUnavailable',
    })
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
  })

  it('fails cleanly when AudioWorklet is unavailable', async () => {
    const originalContext = capture.context.getMockImplementation()!
    capture.context.mockImplementation(function () {
      const context = originalContext()
      Object.defineProperty(context, 'audioWorklet', { value: undefined })
      return context
    })
    const recording = createVoiceRecording(120, vi.fn())

    await expect(recording.start()).rejects.toMatchObject({
      code: 'microphoneUnavailable',
    })
    expect(capture.media).toHaveBeenCalledOnce()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(capture.nodes).toHaveLength(0)
  })

  it('stops a permission grant delivered after cancellation and clears resources once', async () => {
    const grant = deferred<MediaStream>()
    capture.media.mockReturnValue(grant.promise)
    const recording = createVoiceRecording(120, vi.fn())
    const start = recording.start()
    recording.cancel()
    recording.cancel()
    grant.resolve(capture.stream)
    expect(await start).toBe(false)
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
    expect(capture.nodes).toHaveLength(0)
  })

  it('cancels worklet initialization and resampling without publishing late audio', async () => {
    const module = deferred<void>()
    capture.addModule.mockReturnValue(module.promise)
    const initializing = createVoiceRecording(120, vi.fn())
    const start = initializing.start()
    await Promise.resolve()
    initializing.cancel()
    module.resolve()
    expect(await start).toBe(false)
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.nodes).toHaveLength(0)

    capture = captureFixture(48000)
    const rendered = deferred<{ getChannelData: () => Float32Array }>()
    capture.offline.mockImplementationOnce(function () {
      return {
        destination: {},
        createBuffer: () => ({ getChannelData: () => new Float32Array(4800) }),
        createBufferSource: () => ({ connect: vi.fn(), start: vi.fn() }),
        startRendering: () => rendered.promise,
      }
    })
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples(4800) })
    const stopped = recording.stop()
    capture.nodes[0]!.emit({ type: 'stopped' })
    recording.cancel()
    expect(await stopped).toBeNull()
    rendered.resolve({ getChannelData: () => generatedSamples(1600) })
    await Promise.resolve()
    expect(capture.stopTrack).toHaveBeenCalledOnce()

    capture = captureFixture(48000)
    const failedRender = deferred<{ getChannelData: () => Float32Array }>()
    capture.offline.mockImplementationOnce(function () {
      return {
        destination: {},
        createBuffer: () => ({ getChannelData: () => new Float32Array(4800) }),
        createBufferSource: () => ({ connect: vi.fn(), start: vi.fn() }),
        startRendering: () => failedRender.promise,
      }
    })
    const cancelledFailure = createVoiceRecording(120, vi.fn())
    await cancelledFailure.start()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples(4800) })
    const cancelledStop = cancelledFailure.stop()
    capture.nodes[0]!.emit({ type: 'stopped' })
    cancelledFailure.cancel()
    expect(await cancelledStop).toBeNull()
    failedRender.reject(new Error('late render failure'))
    await Promise.resolve()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
  })

  it('cancels during ACK wait without encoding or retaining PCM', async () => {
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples() })
    const stopped = recording.stop()
    recording.cancel()
    capture.nodes[0]!.emit({ type: 'stopped' })
    expect(await stopped).toBeNull()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.offline).not.toHaveBeenCalled()
  })

  it('rejects duplicate starts and resumes a suspended audio context', async () => {
    const originalContext = capture.context.getMockImplementation()!
    capture.context.mockImplementation(function () {
      const context = originalContext()
      Object.defineProperty(context, 'state', { value: 'suspended' })
      return context
    })
    const recording = createVoiceRecording(120, vi.fn())

    expect(await recording.start()).toBe(true)
    expect(await recording.start()).toBe(false)
    expect(capture.media).toHaveBeenCalledOnce()
    expect(capture.resume).toHaveBeenCalledTimes(2)

    const stopped = recording.stop()
    capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples() })
    capture.nodes[0]!.emit({ type: 'stopped' })
    expect(await stopped).toBeInstanceOf(Blob)
  })

  it('abandons initialization when cancelled while resuming a suspended context', async () => {
    const originalContext = capture.context.getMockImplementation()!
    capture.context.mockImplementation(function () {
      const context = originalContext()
      Object.defineProperty(context, 'state', { value: 'suspended' })
      return context
    })
    const secondResume = deferred<void>()
    capture.resume
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondResume.promise)
    const recording = createVoiceRecording(120, vi.fn())
    const start = recording.start()
    await vi.waitFor(() => expect(capture.addModule).toHaveBeenCalledOnce())
    recording.cancel()
    secondResume.resolve()

    expect(await start).toBe(false)
    expect(capture.nodes).toHaveLength(0)
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
  })

  it('ignores worklet messages delivered after cancellation', async () => {
    const recording = createVoiceRecording(120, vi.fn())
    await recording.start()
    const node = capture.nodes[0]!
    const onMessage = node.port.onmessage!
    recording.cancel()
    onMessage({
      data: { type: 'samples', samples: generatedSamples() },
    } as MessageEvent)

    expect(capture.offline).not.toHaveBeenCalled()
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
  })

  it('notifies the UI and rejects stop after the processor fails before stopping', async () => {
    const onLimit = vi.fn()
    const recording = createVoiceRecording(120, onLimit)
    await recording.start()
    capture.nodes[0]!.onprocessorerror?.()

    expect(onLimit).toHaveBeenCalledOnce()
    await expect(recording.stop()).rejects.toMatchObject({
      code: 'microphoneUnavailable',
    })
    expect(capture.stopTrack).toHaveBeenCalledOnce()
    expect(capture.close).toHaveBeenCalledOnce()
  })
})
