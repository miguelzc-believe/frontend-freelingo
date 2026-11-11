import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MessageAudioPlayer, {
  VoicePlayback,
} from '@/components/conversation/MessageAudioPlayer'
import { deferred } from '../helpers/voice-capture'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
beforeEach(() => {
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
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('session-scoped message player', () => {
  it('guards blocked playback and rejects stale playback generations', () => {
    const playback = new VoicePlayback()
    const audio = document.createElement('audio')

    playback.blocked = true
    expect(playback.claim(audio)).toBeNull()
    expect(playback.current(audio)).toBe(false)

    playback.blocked = false
    const generation = playback.claim(audio)!
    expect(playback.current(audio, generation)).toBe(true)
    expect(playback.current(audio, generation + 1)).toBe(false)
    playback.stop()
    expect(playback.current(audio, generation)).toBe(false)
  })

  it('shows duration/progress, seeks and switches play/pause', async () => {
    const activity = vi.fn()
    const { container } = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={new VoicePlayback()}
        onActivity={activity}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'duration', { value: 65 })
    fireEvent.loadedMetadata(audio)
    expect(screen.getByText('0:00 / 1:05')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'progress' }), {
      target: { value: '30' },
    })
    expect(audio.currentTime).toBe(30)
    expect(screen.getByText('0:30 / 1:05')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    await screen.findByRole('button', { name: 'pause' })
    expect(activity).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'pause' }))
    expect(screen.getByRole('button', { name: 'play' })).toBeInTheDocument()
  })

  it('normalizes non-finite metadata and updates duration and current position', () => {
    const { container } = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={new VoicePlayback()}
        onActivity={vi.fn()}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: Number.POSITIVE_INFINITY,
    })
    fireEvent.loadedMetadata(audio)
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 90,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 12.9,
    })
    fireEvent.durationChange(audio)
    fireEvent.timeUpdate(audio)
    expect(screen.getByText('0:12 / 1:30')).toBeInTheDocument()
  })

  it('normalizes negative position and non-finite duration changes', () => {
    const { container } = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={new VoicePlayback()}
        onActivity={vi.fn()}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: Infinity,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      value: -12,
    })
    fireEvent.durationChange(audio)
    fireEvent.timeUpdate(audio)
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'progress' })).toBeDisabled()
  })

  it('stops active playback and releases its source on unmount', async () => {
    const playback = new VoicePlayback()
    const view = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={playback}
        onActivity={vi.fn()}
      />
    )
    const audio = view.container.querySelector('audio')!
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    await screen.findByRole('button', { name: 'pause' })
    expect(playback.current(audio)).toBe(true)
    view.unmount()
    expect(playback.current(audio)).toBe(false)
    expect(audio).not.toHaveAttribute('src')
    expect(pause).toHaveBeenCalled()
  })

  it('shows a generic failure for playback errors and rewinds ended audio', async () => {
    play.mockRejectedValueOnce(new Error('decoder failed'))
    const { container } = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={new VoicePlayback()}
        onActivity={vi.fn()}
      />
    )
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'ended', { configurable: true, value: true })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 23,
    })
    fireEvent.click(screen.getByRole('button', { name: 'play' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'playbackFailed'
    )
    expect(audio.currentTime).toBe(0)
    fireEvent.error(audio)
    expect(screen.getByRole('status')).toHaveTextContent('playbackFailed')
  })

  it('does not play when its control is disabled or another activity blocks playback', () => {
    const activity = vi.fn()
    const playback = new VoicePlayback()
    const { rerender } = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={playback}
        disabled
        onActivity={activity}
      />
    )
    expect(screen.getByRole('button', { name: 'play' })).toBeDisabled()

    rerender(
      <MessageAudioPlayer
        src="blob:generated"
        playback={playback}
        onActivity={activity}
      />
    )
    playback.blocked = true
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    expect(play).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
  })

  it('associates audio and keyboard controls with the actual transcript', () => {
    const { container } = render(
      <>
        <p id="transcript">Hello learner</p>
        <MessageAudioPlayer
          src="blob:generated"
          transcriptId="transcript"
          playback={new VoicePlayback()}
          onActivity={vi.fn()}
        />
      </>
    )
    expect(container.querySelector('audio')).toHaveAttribute(
      'aria-describedby',
      'transcript'
    )
    expect(
      screen.getByRole('button', { name: 'play' })
    ).toHaveAccessibleDescription('Hello learner')
    expect(
      screen.getByRole('slider', { name: 'progress' })
    ).toHaveAccessibleDescription('Hello learner')
  })

  it('auto-plays a newly completed response once with visible rejection fallback', async () => {
    play.mockRejectedValueOnce(new DOMException('autoplay', 'NotAllowedError'))
    const playback = new VoicePlayback()
    const activity = vi.fn()
    const view = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={playback}
        autoPlay
        onActivity={activity}
      />
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'playbackBlocked'
    )
    expect(screen.getByRole('status').tagName).toBe('OUTPUT')
    view.rerender(
      <MessageAudioPlayer
        src="blob:generated"
        playback={playback}
        autoPlay
        onActivity={activity}
      />
    )
    expect(play).toHaveBeenCalledOnce()
    expect(activity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    await screen.findByRole('button', { name: 'pause' })
    expect(play).toHaveBeenCalledTimes(2)
    expect(activity).toHaveBeenCalledOnce()
  })

  it('owns only one playback and blocks late native play events during recording', async () => {
    const playback = new VoicePlayback()
    const view = render(
      <>
        <MessageAudioPlayer
          src="blob:a"
          playback={playback}
          onActivity={vi.fn()}
        />
        <MessageAudioPlayer
          src="blob:b"
          playback={playback}
          onActivity={vi.fn()}
        />
      </>
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'play' })[0]!)
    await screen.findByRole('button', { name: 'pause' })
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'pause' })).toHaveLength(1)
    )
    const audios = view.container.querySelectorAll('audio')
    playback.blocked = true
    act(() => playback.stop())
    const calls = pause.mock.calls.length
    fireEvent.play(audios[1]!)
    expect(pause).toHaveBeenCalledTimes(calls + 1)
    expect(screen.queryByRole('button', { name: 'pause' })).toBeNull()
  })

  it('ignores stale play resolution/rejection after unmount and clears audio sources', async () => {
    const pending = deferred<void>()
    play.mockReturnValueOnce(pending.promise)
    const view = render(
      <MessageAudioPlayer
        src="blob:generated"
        playback={new VoicePlayback()}
        autoPlay
        onActivity={vi.fn()}
      />
    )
    const audio = view.container.querySelector('audio')!
    view.unmount()
    expect(audio.getAttribute('src')).toBeNull()
    await act(async () =>
      pending.reject(new DOMException('blocked', 'NotAllowedError'))
    )
    expect(screen.queryByText('playbackBlocked')).toBeNull()
  })
})
