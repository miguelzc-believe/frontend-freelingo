import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'

/** Scoped to a single mounted conversation, never a global audio singleton. */
export class VoicePlayback {
  private active: HTMLAudioElement | null = null
  private generation = 0
  private readonly players = new Set<HTMLAudioElement>()
  blocked = false

  register(audio: HTMLAudioElement) {
    this.players.add(audio)
    return () => {
      this.players.delete(audio)
      if (this.active === audio) this.stop()
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }

  claim(audio: HTMLAudioElement): number | null {
    if (this.blocked) return null
    this.stop()
    this.active = audio
    return this.generation
  }

  current(audio: HTMLAudioElement, generation?: number): boolean {
    return (
      !this.blocked &&
      this.active === audio &&
      (generation === undefined || generation === this.generation)
    )
  }

  stop() {
    this.generation++
    this.active = null
    this.players.forEach((audio) => audio.pause())
  }
}

function time(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export default function MessageAudioPlayer({
  src,
  playback,
  autoPlay = false,
  disabled = false,
  onActivity,
}: Readonly<{
  src: string
  playback: VoicePlayback
  autoPlay?: boolean
  disabled?: boolean
  onActivity: () => void
}>) {
  const t = useTranslations('conversation.voiceMessages')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const attemptedRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState<
    'playbackBlocked' | 'playbackFailed' | null
  >(null)

  async function play(explicit: boolean) {
    const audio = audioRef.current
    if (!audio || disabled) return
    const generation = playback.claim(audio)
    if (generation === null) return
    if (explicit) onActivity()
    setError(null)
    try {
      if (audio.ended) audio.currentTime = 0
      await audio.play()
      if (playback.current(audio, generation)) setPlaying(true)
    } catch (reason) {
      if (!playback.current(audio, generation)) return
      setPlaying(false)
      setError(
        (reason instanceof Error || reason instanceof DOMException) &&
          reason.name === 'NotAllowedError'
          ? 'playbackBlocked'
          : 'playbackFailed'
      )
    }
  }

  useEffect(() => {
    const audio = audioRef.current!
    // Effect replay can follow source-detaching cleanup without a DOM update.
    if (audio.getAttribute('src') !== src) audio.setAttribute('src', src)
    return playback.register(audio)
  }, [playback, src])

  useEffect(() => {
    if (autoPlay && !attemptedRef.current) {
      attemptedRef.current = true
      void play(false)
    }
    // Each newly completed message gets one attempt, not an effect-driven loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, src])

  return (
    <div className="border-fl-border bg-fl-surface text-fl-fg w-full min-w-48 border px-3 py-2 font-mono text-xs">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const value = audioRef.current?.duration ?? 0
          setDuration(Number.isFinite(value) ? value : 0)
        }}
        onDurationChange={() => {
          const value = audioRef.current?.duration ?? 0
          setDuration(Number.isFinite(value) ? value : 0)
        }}
        onTimeUpdate={() => setPosition(audioRef.current?.currentTime ?? 0)}
        onPlay={() => {
          const audio = audioRef.current!
          if (!playback.current(audio)) audio.pause()
          else setPlaying(true)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false)
          setError('playbackFailed')
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          aria-label={t(playing ? 'pause' : 'play')}
          onClick={() => {
            if (playing) audioRef.current?.pause()
            else void play(true)
          }}
          className="hover:text-fl-accent px-1 py-2 disabled:opacity-40"
        >
          {playing ? 'Ⅱ' : '▶'}
        </button>
        <input
          type="range"
          aria-label={t('progress')}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(position, duration)}
          disabled={disabled || !duration}
          className="accent-fl-accent min-w-0 flex-1"
          onChange={(event) => {
            const value = Number(event.target.value)
            if (audioRef.current) audioRef.current.currentTime = value
            setPosition(value)
          }}
        />
        <span className="text-fl-muted-2 shrink-0 tabular-nums">
          {time(position)} / {time(duration)}
        </span>
      </div>
      {error && (
        <p role="status" className="text-fl-error mt-1">
          {t(error)}
        </p>
      )}
    </div>
  )
}
