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
    expect(await screen.findByText('playbackBlocked')).toBeInTheDocument()
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
    expect(pause.mock.calls.length).toBe(calls + 1)
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
