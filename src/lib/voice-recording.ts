import { float32ToWav } from '@/lib/audio'

export type VoiceRecordingErrorCode =
  'microphoneUnavailable' | 'emptyRecording' | 'cancelled'

export class VoiceRecordingError extends Error {
  constructor(public readonly code: VoiceRecordingErrorCode) {
    super(code)
    this.name = 'VoiceRecordingError'
  }
}

export interface VoiceRecording {
  start: () => Promise<boolean>
  stop: () => Promise<Blob | null>
  cancel: () => void
}

/** One explicit recording; no permissions, capture or persistence until start(). */
export function createVoiceRecording(
  maxSeconds: number,
  onLimit: () => void
): VoiceRecording {
  const limit = Math.min(120, Math.max(1, maxSeconds))
  let phase: 'idle' | 'initializing' | 'recording' | 'stopping' | 'finished' =
    'idle'
  let cancelled = false
  let stream: MediaStream | null = null
  let audio: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let node: AudioWorkletNode | null = null
  let chunks: Float32Array[] = []
  let captured = 0
  let autoStop: ReturnType<typeof setTimeout> | null = null
  let ackTimeout: ReturnType<typeof setTimeout> | null = null
  let resolveStop: ((value: Blob | null) => void) | null = null
  let rejectStop: ((reason: unknown) => void) | null = null
  let stopPromise: Promise<Blob | null> | null = null
  let processorFailed = false

  function cleanup() {
    if (autoStop) clearTimeout(autoStop)
    if (ackTimeout) clearTimeout(ackTimeout)
    autoStop = ackTimeout = null
    if (node) {
      node.port.onmessage = null
      node.onprocessorerror = null
      node.disconnect()
      node.port.close()
      node = null
    }
    source?.disconnect()
    source = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (audio) void audio.close().catch(() => {})
    audio = null
  }

  function fail() {
    processorFailed = true
    phase = 'finished'
    cleanup()
    chunks = []
    rejectStop?.(new VoiceRecordingError('microphoneUnavailable'))
    // A processor failure before stop still takes the normal UI error path.
    if (!stopPromise) onLimit()
  }

  async function encode(inputRate: number) {
    // The worklet's stopped message is a FIFO flush barrier. Release capture
    // before resampling/upload, including on empty recording and encode failure.
    cleanup()
    try {
      if (!captured) throw new VoiceRecordingError('emptyRecording')
      const combined = new Float32Array(captured)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      chunks = []
      let samples = combined
      if (inputRate !== 16000) {
        const offline = new OfflineAudioContext(
          1,
          Math.ceil((combined.length * 16000) / inputRate),
          16000
        )
        const buffer = offline.createBuffer(1, combined.length, inputRate)
        buffer.getChannelData(0).set(combined)
        const resampler = offline.createBufferSource()
        resampler.buffer = buffer
        resampler.connect(offline.destination)
        resampler.start(0)
        const rendered = await offline.startRendering()
        samples = rendered.getChannelData(0)
      }
      if (cancelled) return
      phase = 'finished'
      resolveStop?.(
        new Blob([float32ToWav(samples, 16000)], { type: 'audio/wav' })
      )
    } catch (error) {
      if (!cancelled) {
        phase = 'finished'
        rejectStop?.(
          error instanceof VoiceRecordingError
            ? error
            : new VoiceRecordingError('microphoneUnavailable')
        )
      }
    }
  }

  async function start(): Promise<boolean> {
    if (phase !== 'idle') return false
    phase = 'initializing'
    try {
      // Construct on the record gesture, never on session creation/autoStart.
      const context = new AudioContext()
      audio = context
      const permission = navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (context.state === 'suspended') void context.resume().catch(() => {})
      const granted = await permission
      if (cancelled) {
        granted.getTracks().forEach((track) => track.stop())
        return false
      }
      stream = granted
      if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        throw new VoiceRecordingError('microphoneUnavailable')
      }
      await context.audioWorklet.addModule('/audio/voice-recorder.worklet.js')
      if (cancelled) return false
      if (context.state === 'suspended') await context.resume()
      if (cancelled) return false
      const worklet = new AudioWorkletNode(context, 'voice-recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      node = worklet
      worklet.onprocessorerror = fail
      worklet.port.onmessage = ({
        data,
      }: MessageEvent<{ type: string; samples?: Float32Array }>) => {
        if (cancelled) return
        if (data.type === 'samples' && data.samples instanceof Float32Array) {
          const available = Math.max(
            0,
            Math.floor(context.sampleRate * limit) - captured
          )
          const chunk = data.samples.slice(0, available)
          if (chunk.length) {
            chunks.push(chunk)
            captured += chunk.length
          }
        } else if (data.type === 'stopped' && phase === 'stopping') {
          // Change phase before async encode so duplicate ACKs cannot re-encode.
          phase = 'finished'
          void encode(context.sampleRate)
        }
      }
      source = context.createMediaStreamSource(granted)
      source.connect(worklet)
      worklet.connect(context.destination) // Worklet outputs silence, no feedback.
      phase = 'recording'
      autoStop = setTimeout(onLimit, limit * 1000)
      return true
    } catch {
      cleanup()
      phase = 'finished'
      if (cancelled) return false
      throw new VoiceRecordingError('microphoneUnavailable')
    }
  }

  function cancel() {
    cancelled = true
    phase = 'finished'
    cleanup()
    chunks = []
    resolveStop?.(null)
  }

  function stop(): Promise<Blob | null> {
    if (processorFailed)
      return Promise.reject(new VoiceRecordingError('microphoneUnavailable'))
    if (stopPromise) return stopPromise
    if (phase !== 'recording') {
      cancel()
      return Promise.resolve(null)
    }
    phase = 'stopping'
    if (autoStop) clearTimeout(autoStop)
    autoStop = null
    stopPromise = new Promise((resolve, reject) => {
      resolveStop = resolve
      rejectStop = reject
    })
    ackTimeout = setTimeout(fail, 3000)
    try {
      node!.port.postMessage({ type: 'stop' })
    } catch {
      fail()
    }
    return stopPromise
  }

  return { start, stop, cancel }
}
