import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { apiFetch } from '@/lib/api'

interface ExerciseAudioPlayerProps {
  exerciseId: number
  onFirstPlay?: () => void
}

const SEEK_STEP_SECONDS = 5

export function ExerciseAudioPlayer({
  exerciseId,
  onFirstPlay,
}: Readonly<ExerciseAudioPlayerProps>) {
  const t = useTranslations('listening')
  const [state, setState] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'error'
  >('idle')
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const playedRef = useRef(false)

  async function handlePlayPause() {
    if (state === 'loading') return

    if (state === 'playing') {
      audioRef.current?.pause()
      setState('paused')
      return
    }

    if (state === 'paused' && audioRef.current) {
      try {
        await audioRef.current.play()
        setState('playing')
      } catch {
        setState('error')
      }
      return
    }

    setState('loading')
    try {
      const res = await apiFetch(`/api/listening/audio/${exerciseId}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })
      audio.addEventListener('timeupdate', () => {
        if (audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100)
        }
      })
      audio.addEventListener('ended', () => {
        setProgress(100)
        setState('idle')
      })
      audio.addEventListener('error', () => setState('error'))

      await audio.play()
      setState('playing')

      if (!playedRef.current) {
        playedRef.current = true
        onFirstPlay?.()
      }
    } catch {
      setState('error')
    }
  }

  function seekToRatio(ratio: number) {
    const audio = audioRef.current
    if (!audio || audio.duration === 0) return
    const clamped = Math.min(1, Math.max(0, ratio))
    audio.currentTime = clamped * audio.duration
    setProgress(clamped * 100)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    seekToRatio((e.clientX - rect.left) / rect.width)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const key = e.key
    if (
      key !== 'ArrowLeft' &&
      key !== 'ArrowRight' &&
      key !== 'ArrowUp' &&
      key !== 'ArrowDown' &&
      key !== 'Home' &&
      key !== 'End'
    ) {
      return
    }
    e.preventDefault()
    const audio = audioRef.current
    if (!audio || audio.duration === 0) return
    const step = SEEK_STEP_SECONDS / audio.duration
    const current = audio.currentTime / audio.duration
    if (key === 'Home') {
      seekToRatio(0)
    } else if (key === 'End') {
      seekToRatio(1)
    } else if (key === 'ArrowRight' || key === 'ArrowUp') {
      seekToRatio(current + step)
    } else {
      seekToRatio(current - step)
    }
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  let icon = '▶'
  if (state === 'loading') {
    icon = '◌'
  } else if (state === 'playing') {
    icon = '▐▐'
  }
  const label = state === 'playing' ? 'Pause' : 'Play'

  return (
    <div className="border-fl-border bg-fl-surface space-y-2 border p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          disabled={state === 'loading'}
          aria-label={label}
          className="text-fl-fg hover:text-fl-fg-bright w-8 shrink-0 text-center font-mono text-base transition-colors disabled:opacity-40"
        >
          {icon}
        </button>

        <div
          className="bg-fl-border focus-visible:outline-fl-fg relative h-1.5 flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={handleSeek}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
          aria-label={t('seekLabel')}
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-fl-accent h-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {duration > 0 && (
          <span className="text-fl-label text-fl-muted-3 shrink-0 font-mono tabular-nums">
            {Math.ceil(duration)}s
          </span>
        )}
      </div>
      {state === 'error' && (
        <p className="text-fl-label font-mono text-red-500">
          {t('audioError')}
        </p>
      )}
    </div>
  )
}
