import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetch, configState } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  configState: { ttsProvider: 'openai', openaiTtsVoice: 'nova' },
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({ apiFetch }))

vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: typeof configState) => unknown) =>
    selector(configState),
}))

import { VoiceSection } from '@/components/settings/VoiceSection'

class MockAudio {
  static instances: MockAudio[] = []

  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  pause = vi.fn()
  play = vi.fn().mockResolvedValue(undefined)

  constructor(readonly src: string) {
    MockAudio.instances.push(this)
  }
}

describe('VoiceSection', () => {
  beforeEach(() => {
    configState.ttsProvider = 'openai'
    configState.openaiTtsVoice = 'nova'
    apiFetch.mockReset()
    MockAudio.instances = []
    localStorage.removeItem('tts_voice')
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when OpenAI is not the configured TTS provider', () => {
    configState.ttsProvider = 'local'
    const { container } = render(<VoiceSection />)
    expect(container).toBeEmptyDOMElement()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('uses a valid stored voice and saves a newly selected voice', () => {
    localStorage.setItem('tts_voice', 'echo')
    render(<VoiceSection title="Tutor voice" />)

    const select = screen.getByRole('combobox')
    expect(screen.getByText('Tutor voice')).toBeInTheDocument()
    expect(select).toHaveValue('echo')

    fireEvent.change(select, { target: { value: 'sage' } })
    expect(select).toHaveValue('sage')
    expect(localStorage.getItem('tts_voice')).toBe('sage')
  })

  it('falls back to the configured voice when the stored value is invalid', () => {
    localStorage.setItem('tts_voice', 'invalid')
    configState.openaiTtsVoice = 'coral'
    render(<VoiceSection />)
    expect(screen.getByRole('combobox')).toHaveValue('coral')
  })

  it('plays the preview, stops it on request and revokes its URL when playback ends', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:voice-preview')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    apiFetch.mockImplementation(async () => new Response(new Blob(['audio'])))
    const { unmount } = render(<VoiceSection />)

    fireEvent.click(screen.getByRole('button', { name: 'voicePlay' }))
    await waitFor(() => expect(MockAudio.instances).toHaveLength(1))
    const audio = MockAudio.instances[0]
    expect(audio?.src).toBe('blob:voice-preview')
    expect(audio?.play).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'voiceStop' })
    ).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/api/tts/preview/nova')

    fireEvent.click(screen.getByRole('button', { name: 'voiceStop' }))
    expect(audio?.pause).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'voicePlay' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'voicePlay' }))
    await waitFor(() => expect(MockAudio.instances).toHaveLength(2))
    const playingAudio = MockAudio.instances[1]
    playingAudio?.onended?.()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice-preview')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'voicePlay' })
      ).toBeInTheDocument()
    )
    unmount()
    expect(createObjectURL).toHaveBeenCalledTimes(2)
  })

  it('cleans up audio and resets the control when a preview fails', async () => {
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-preview')
    apiFetch.mockImplementation(async () => new Response(new Blob(['audio'])))
    const { unmount } = render(<VoiceSection />)

    fireEvent.click(screen.getByRole('button', { name: 'voicePlay' }))
    await waitFor(() => expect(MockAudio.instances).toHaveLength(1))
    act(() => MockAudio.instances[0]?.onerror?.())

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'voicePlay' })
      ).toBeInTheDocument()
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-preview')

    fireEvent.click(screen.getByRole('button', { name: 'voicePlay' }))
    await waitFor(() => expect(MockAudio.instances).toHaveLength(2))
    unmount()
    expect(MockAudio.instances[1]?.pause).toHaveBeenCalledOnce()
  })

  it('restores the play control after a non-OK preview response', async () => {
    apiFetch.mockResolvedValue(new Response(null, { status: 503 }))
    render(<VoiceSection />)
    fireEvent.click(screen.getByRole('button', { name: 'voicePlay' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'voicePlay' })).toBeEnabled()
    )
    expect(MockAudio.instances).toHaveLength(0)
  })
})
