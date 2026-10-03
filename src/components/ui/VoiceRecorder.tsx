import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { apiFetch } from '@/lib/api'
import { float32ToWav } from '@/lib/audio'

interface VoiceRecorderProps {
  studyPlanId: number
  onTranscription: (text: string) => void | Promise<void>
  maxSeconds?: number
  disabled?: boolean
  className?: string
}

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error'

interface RecordingContext {
  studyPlanId: number
  onTranscription: VoiceRecorderProps['onTranscription']
}

interface RecordingSession extends RecordingContext {
  phase: 'initializing' | 'recording' | 'stopping'
  chunks: Float32Array[]
  stream: MediaStream | null
  audio: AudioContext | null
  source: MediaStreamAudioSourceNode | null
  node: AudioWorkletNode | null
  autoStop: ReturnType<typeof setTimeout> | null
  ackTimeout: ReturnType<typeof setTimeout> | null
  abort: AbortController | null
}

export function VoiceRecorder({
  studyPlanId,
  onTranscription,
  maxSeconds = 5,
  disabled = false,
  className = '',
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const sessionRef = useRef<RecordingSession | null>(null)
  const errorResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const t = useTranslations('voiceRecorder')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (errorResetRef.current) clearTimeout(errorResetRef.current)
      const session = sessionRef.current
      sessionRef.current = null
      if (session) {
        session.abort?.abort()
        cleanupAudio(session)
      }
    }
  }, [])

  function isCurrent(session: RecordingSession) {
    return mountedRef.current && sessionRef.current === session
  }

  function cleanupAudio(session: RecordingSession) {
    if (session.autoStop) clearTimeout(session.autoStop)
    if (session.ackTimeout) clearTimeout(session.ackTimeout)
    session.autoStop = null
    session.ackTimeout = null
    if (session.node) {
      session.node.port.onmessage = null
      session.node.onprocessorerror = null
      session.node.disconnect()
      session.node.port.close()
      session.node = null
    }
    session.source?.disconnect()
    session.source = null
    if (session.audio) void session.audio.close().catch(() => {})
    session.audio = null
    session.stream?.getTracks().forEach((track) => track.stop())
    session.stream = null
  }

  function showError(session: RecordingSession) {
    if (!isCurrent(session)) return
    sessionRef.current = null
    session.abort?.abort()
    cleanupAudio(session)
    setState('error')
    if (errorResetRef.current) clearTimeout(errorResetRef.current)
    errorResetRef.current = setTimeout(() => {
      if (mountedRef.current) setState('idle')
      errorResetRef.current = null
    }, 2000)
  }

  async function processAndSend(session: RecordingSession, inputRate: number) {
    try {
      const chunks = session.chunks
      session.chunks = []
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      if (!totalLength) throw new Error('No recorded audio')
      const combined = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      let samples = combined
      if (inputRate !== 16000) {
        const offlineCtx = new OfflineAudioContext(
          1,
          Math.ceil((combined.length * 16000) / inputRate),
          16000
        )
        const buffer = offlineCtx.createBuffer(1, combined.length, inputRate)
        buffer.getChannelData(0).set(combined)
        const source = offlineCtx.createBufferSource()
        source.buffer = buffer
        source.connect(offlineCtx.destination)
        source.start(0)
        const rendered = await offlineCtx.startRendering()
        samples = rendered.getChannelData(0)
      }
      if (!isCurrent(session)) return
      const wav = float32ToWav(samples, 16000)
      const formData = new FormData()
      formData.append(
        'audio',
        new Blob([wav], { type: 'audio/wav' }),
        'recording.wav'
      )
      formData.append('study_plan_id', String(session.studyPlanId))
      session.abort = new AbortController()
      const res = await apiFetch('/api/stt', {
        method: 'POST',
        body: formData,
        signal: session.abort.signal,
      })
      if (!isCurrent(session)) return
      if (!res.ok) throw new Error(`STT error ${res.status}`)
      const { text } = (await res.json()) as { text: string }
      if (!isCurrent(session)) return
      await session.onTranscription(text)
      if (isCurrent(session)) {
        sessionRef.current = null
        setState('idle')
      }
    } catch {
      showError(session)
    } finally {
      session.abort = null
    }
  }

  function stopRecording(session = sessionRef.current) {
    if (!session || !isCurrent(session) || session.phase === 'stopping') return
    if (session.autoStop) clearTimeout(session.autoStop)
    session.autoStop = null
    if (session.phase === 'initializing') {
      sessionRef.current = null
      cleanupAudio(session)
      setState('idle')
      return
    }
    session.phase = 'stopping'
    setState('transcribing')
    session.ackTimeout = setTimeout(() => showError(session), 3000)
    try {
      session.node!.port.postMessage({ type: 'stop' })
    } catch {
      showError(session)
    }
  }

  async function startRecording() {
    const session: RecordingSession = {
      studyPlanId,
      onTranscription,
      phase: 'initializing',
      chunks: [],
      stream: null,
      audio: null,
      source: null,
      node: null,
      autoStop: null,
      ackTimeout: null,
      abort: null,
    }
    sessionRef.current = session
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!isCurrent(session)) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      session.stream = stream
      const audio = new AudioContext()
      session.audio = audio
      if (!audio.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        throw new Error('AudioWorklet unavailable')
      }
      await audio.audioWorklet.addModule('/audio/voice-recorder.worklet.js')
      if (!isCurrent(session)) return
      if (audio.state === 'suspended') {
        await audio.resume()
        if (!isCurrent(session)) return
      }
      const node = new AudioWorkletNode(audio, 'voice-recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      session.node = node
      node.onprocessorerror = () => showError(session)
      node.port.onmessage = ({
        data,
      }: MessageEvent<{
        type: string
        samples?: Float32Array
      }>) => {
        if (!isCurrent(session)) return
        if (data.type === 'samples' && data.samples instanceof Float32Array) {
          session.chunks.push(data.samples)
        } else if (data.type === 'stopped' && session.phase === 'stopping') {
          const inputRate = audio.sampleRate
          cleanupAudio(session)
          void processAndSend(session, inputRate)
        }
      }
      session.source = audio.createMediaStreamSource(stream)
      session.source.connect(node)
      node.connect(audio.destination)
      session.phase = 'recording'
      session.autoStop = setTimeout(
        () => stopRecording(session),
        maxSeconds * 1000
      )
    } catch {
      showError(session)
    }
  }

  async function handleClick() {
    if (state === 'recording') {
      stopRecording()
      return
    }
    if (disabled || state !== 'idle' || sessionRef.current) return
    setState('recording')
    await startRecording()
  }

  const label =
    state === 'recording'
      ? `■ ${t('stop')}`
      : state === 'transcribing'
        ? `... ${t('processing')}`
        : state === 'error'
          ? `✕ ${t('error')}`
          : `● ${t('record')}`

  const colorClass =
    state === 'recording'
      ? 'border-fl-error/60 text-fl-error-fg animate-pulse'
      : state === 'transcribing'
        ? 'border-fl-border text-fl-muted-3 animate-pulse'
        : state === 'error'
          ? 'border-fl-error/40 text-fl-error-fg'
          : disabled
            ? 'border-fl-border text-fl-muted-4 cursor-not-allowed opacity-40'
            : 'border-fl-border text-fl-muted-2 hover:border-fl-border-2 hover:text-fl-fg'

  return (
    <button
      onClick={handleClick}
      disabled={disabled && state === 'idle'}
      aria-label={state === 'recording' ? t('ariaStop') : t('ariaRecord')}
      className={`border px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${colorClass} ${className}`}
    >
      {label}
    </button>
  )
}
