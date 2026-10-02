import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

import { ExerciseAudioPlayer } from '@/components/ui/exercise-audio-player'

type AudioEvent = 'loadedmetadata' | 'timeupdate' | 'ended' | 'error'

function makeAudio() {
  const listeners = new Map<AudioEvent, Array<() => void>>()
  return {
    duration: 0,
    currentTime: 0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((type: AudioEvent, listener: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    }),
    emit(type: AudioEvent) {
      listeners.get(type)?.forEach((listener) => listener())
    },
  }
}

const originalAudioDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'Audio'
)
let audio: ReturnType<typeof makeAudio>
let createdUrls: string[]
let revokedUrls: string[]
let urlNumber: number

function response(ok = true) {
  return {
    ok,
    status: ok ? 200 : 503,
    blob: vi.fn().mockResolvedValue(new Blob(['audio'])),
  }
}

async function startPlaying() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  })
}

describe('ExerciseAudioPlayer', () => {
  beforeEach(() => {
    audio = makeAudio()
    createdUrls = []
    revokedUrls = []
    urlNumber = 0
    mocks.apiFetch.mockReset()
    mocks.apiFetch.mockResolvedValue(response())
    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      writable: true,
      value: function AudioMock() {
        return audio
      },
    })
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:exercise-${++urlNumber}`
      createdUrls.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revokedUrls.push(url)
    })
  })

  afterEach(() => {
    if (originalAudioDescriptor) {
      Object.defineProperty(globalThis, 'Audio', originalAudioDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'Audio')
    }
    vi.restoreAllMocks()
  })

  it('fetches the exercise audio, disables while loading, and reports first play once', async () => {
    let resolveFetch!: (value: ReturnType<typeof response>) => void
    mocks.apiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )
    const onFirstPlay = vi.fn()
    render(<ExerciseAudioPlayer exerciseId={42} onFirstPlay={onFirstPlay} />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/listening/audio/42')
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('◌')

    await act(async () => resolveFetch(response()))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(onFirstPlay).toHaveBeenCalledTimes(1)
    expect(createdUrls).toEqual(['blob:exercise-1'])

    await act(async () => audio.emit('ended'))
    await startPlaying()
    expect(onFirstPlay).toHaveBeenCalledTimes(1)
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2)
  })

  it('renders metadata and time progress, ignores zero-duration updates, and returns idle on ended', async () => {
    render(<ExerciseAudioPlayer exerciseId={7} />)
    await startPlaying()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/listening/audio/7')

    audio.duration = 10.2
    await act(async () => audio.emit('loadedmetadata'))
    expect(screen.getByText('11s')).toBeInTheDocument()
    audio.currentTime = 3
    await act(async () => audio.emit('timeupdate'))
    const progress = screen.getByRole('slider')
    expect(progress).toHaveAttribute('aria-valuenow', '29')

    audio.duration = 0
    audio.currentTime = 2
    await act(async () => audio.emit('timeupdate'))
    expect(progress).toHaveAttribute('aria-valuenow', '29')

    await act(async () => audio.emit('ended'))
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(progress).toHaveAttribute('aria-valuenow', '100')
  })

  it('pauses, resumes, and shows an error when a paused audio cannot resume', async () => {
    render(<ExerciseAudioPlayer exerciseId={9} />)
    await startPlaying()

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    )
    expect(audio.pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()

    await startPlaying()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    )
    audio.play.mockRejectedValueOnce(new Error('resume denied'))
    await startPlaying()
    expect(screen.getByText('audioError')).toBeInTheDocument()
  })

  it.each([
    [
      'non-OK response',
      () => mocks.apiFetch.mockResolvedValueOnce(response(false)),
    ],
    [
      'network failure',
      () => mocks.apiFetch.mockRejectedValueOnce(new Error('offline')),
    ],
    [
      'initial play rejection',
      () => {
        audio.play.mockRejectedValueOnce(new Error('blocked'))
      },
    ],
  ])('shows translated error for %s', async (_case, setup) => {
    setup()
    render(<ExerciseAudioPlayer exerciseId={18} />)
    await startPlaying()
    expect(screen.getByText('audioError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()
  })

  it('handles audio errors, guards seeking without duration, seeks by track ratio, and cleans up on unmount', async () => {
    const { unmount } = render(<ExerciseAudioPlayer exerciseId={23} />)
    const progress = screen.getByRole('slider')
    fireEvent.click(progress, { clientX: 50 })
    expect(audio.currentTime).toBe(0)

    await startPlaying()
    audio.duration = 8
    vi.spyOn(progress, 'getBoundingClientRect').mockReturnValue({
      ...progress.getBoundingClientRect(),
      left: 0,
      width: 100,
    } as DOMRect)
    fireEvent.click(progress, { clientX: 50 })
    expect(audio.currentTime).toBe(4)
    expect(progress).toHaveAttribute('aria-valuenow', '50')

    await act(async () => audio.emit('error'))
    expect(screen.getByText('audioError')).toBeInTheDocument()
    unmount()
    expect(audio.pause).toHaveBeenCalled()
    expect(revokedUrls).toEqual(['blob:exercise-1'])

    const idle = render(<ExerciseAudioPlayer exerciseId={24} />)
    idle.unmount()
    expect(revokedUrls).toEqual(['blob:exercise-1'])
  })

  it('exposes the seek slider as focusable with an accessible name', () => {
    render(<ExerciseAudioPlayer exerciseId={30} />)
    const slider = screen.getByRole('slider', { name: 'seekLabel' })
    expect(slider).toHaveAttribute('tabindex', '0')
  })

  it('moves the seek position by five seconds with the arrow keys', async () => {
    render(<ExerciseAudioPlayer exerciseId={31} />)
    const slider = screen.getByRole('slider')
    await startPlaying()
    audio.duration = 10

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(audio.currentTime).toBe(5)
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(audio.currentTime).toBe(10)
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(audio.currentTime).toBe(5)
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(audio.currentTime).toBe(0)
  })

  it('seeks to the track bounds with Home and End', async () => {
    render(<ExerciseAudioPlayer exerciseId={32} />)
    const slider = screen.getByRole('slider')
    await startPlaying()
    audio.duration = 10
    audio.currentTime = 4

    fireEvent.keyDown(slider, { key: 'Home' })
    expect(audio.currentTime).toBe(0)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(audio.currentTime).toBe(10)
  })

  it('ignores keyboard seeking while the duration is unknown', async () => {
    render(<ExerciseAudioPlayer exerciseId={33} />)
    const slider = screen.getByRole('slider')
    await startPlaying()
    audio.duration = 0
    audio.currentTime = 3

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    fireEvent.keyDown(slider, { key: 'Home' })
    fireEvent.keyDown(slider, { key: 'End' })
    expect(audio.currentTime).toBe(3)
  })

  it('clamps keyboard seeks so currentTime stays within the track bounds', async () => {
    render(<ExerciseAudioPlayer exerciseId={34} />)
    const slider = screen.getByRole('slider')
    await startPlaying()
    audio.duration = 10
    audio.currentTime = 2

    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(audio.currentTime).toBe(0)
    expect(audio.currentTime).toBeGreaterThanOrEqual(0)

    audio.currentTime = 8
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(audio.currentTime).toBe(10)
    expect(audio.currentTime).toBeLessThanOrEqual(10)
  })
})
