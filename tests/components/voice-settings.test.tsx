import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type User } from '@/store/auth'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => mocks)
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

import { VoiceProviderSettings } from '@/components/settings/VoiceProviderSettings'

const ttsSaved = {
  configured: true,
  base_url: 'https://gateway.example/v1',
  model: 'openai/gpt-4o-mini-tts',
  has_api_key: true,
  revision: 2,
  voice: 'coral',
  speed: 1.1,
}
const sttSaved = {
  configured: true,
  base_url: 'https://gateway.example/v1',
  model: 'openai/whisper-1',
  has_api_key: true,
  revision: 1,
}
const missing = {
  configured: false,
  base_url: null,
  model: null,
  has_api_key: false,
  revision: 0,
}
const admin: User = {
  id: 1,
  role: 'admin',
  username: 'voice-admin',
  displayName: 'Voice Admin',
  conversation_max_duration: 15,
  conversation_inactivity_timeout: 1,
}
const learner: User = { ...admin, id: 2, role: 'user' }

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(
  role: User['role'] = 'admin',
  voiceSettings?: { tts?: typeof missing; stt?: typeof missing }
) {
  useAuthStore.setState({
    user: role === 'admin' ? admin : learner,
    accessToken: 'test',
  })
  mocks.apiFetch.mockImplementation((path: string) =>
    Promise.resolve(
      response(
        path === '/api/admin/tts-settings'
          ? (voiceSettings?.tts ?? ttsSaved)
          : path === '/api/admin/stt-settings'
            ? (voiceSettings?.stt ?? sttSaved)
            : path === '/api/tts-settings/status'
              ? { configured: true, model: ttsSaved.model }
              : path === '/api/stt-settings/status'
                ? { configured: false, model: null }
                : { ok: true }
      )
    )
  )
  return render(<VoiceProviderSettings />)
}

async function byName(name: string) {
  return screen.findByLabelText(name)
}

async function change(name: string, value: string) {
  fireEvent.change(await byName(name), { target: { value } })
}

function findBody(path: string) {
  const call = mocks.apiFetch.mock.calls.find(
    ([url, options]) => url === path && options?.body
  )
  return JSON.parse(call?.[1].body as string) as Record<string, unknown>
}

describe('OmniRoute voice settings', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('renders independent admin TTS/STT forms and never echoes saved credentials', async () => {
    setup()
    expect(await byName('ttsModel')).toHaveValue(ttsSaved.model)
    expect(await byName('sttModel')).toHaveValue(sttSaved.model)
    expect(await byName('ttsBaseUrl')).toHaveValue(ttsSaved.base_url)
    expect(await byName('ttsVoice')).toHaveValue('coral')
    expect(await byName('ttsSpeed')).toHaveValue(1.1)
    expect(await byName('ttsApiKey')).toHaveValue('')
    expect(await byName('sttApiKey')).toHaveValue('')
    expect(await byName('ttsApiKey')).toHaveAttribute('type', 'password')
    expect(screen.getAllByText('keySaved')).toHaveLength(2)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(ttsSaved.model)
  })

  it('uses the OmniRoute default URL and validates each draft before saving', async () => {
    const view = setup('admin', { tts: missing, stt: missing })
    expect(await byName('ttsBaseUrl')).toHaveValue(
      'https://omniroute.miguel-zapata.com/v1'
    )
    expect(await byName('ttsSpeed')).toHaveValue(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'save' })[0]!)
    expect(await screen.findByText('required')).toBeInTheDocument()
    view.unmount()
  })

  it('saves TTS metadata and a write-only key without leaking it', async () => {
    setup()
    await byName('ttsModel')
    await change('ttsModel', 'openai/gpt-4o-mini-tts')
    await change('ttsApiKey', 'voice-fixture-secret')
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        response(path.endsWith('/tts-settings') ? ttsSaved : { ok: true })
      )
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'save' })[0]!)
    await screen.findByText('saveSuccess')
    const submitted = findBody('/api/admin/tts-settings')
    expect(submitted).toMatchObject({
      base_url: ttsSaved.base_url,
      model: ttsSaved.model,
      voice: 'coral',
      speed: 1.1,
      api_key: 'voice-fixture-secret',
    })
    expect(JSON.stringify(submitted)).not.toContain('unexpected-provider-error')
    expect(await byName('ttsApiKey')).toHaveValue('')
  })

  it('plays a TTS connection-test sample from a bounded audio response', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'Audio',
      class {
        onended: (() => void) | null = null
        onerror: (() => void) | null = null
        play = play
        constructor(public src: string) {}
      }
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    setup()
    await byName('ttsModel')
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        response(
          path.endsWith('/test')
            ? { ok: true, audio_base64: 'SUQz', content_type: 'audio/mpeg' }
            : ttsSaved
        )
      )
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'test' })[0]!)
    await screen.findByText('testSuccess')
    expect(findBody('/api/admin/tts-settings/test').model).toBe(
      'openai/gpt-4o-mini-tts'
    )
    expect(play).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('tests STT independently without placing the key in browser storage', async () => {
    setup()
    await byName('sttModel')
    await change('sttApiKey', 'stt-fixture-secret')
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        response(path.endsWith('/test') ? { ok: true } : sttSaved)
      )
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'test' })[1]!)
    await screen.findByText('testSuccess')
    expect(findBody('/api/admin/stt-settings/test')).toMatchObject({
      model: 'openai/whisper-1',
      api_key: 'stt-fixture-secret',
    })
    expect(
      JSON.stringify({ ...localStorage, ...sessionStorage })
    ).not.toContain('stt-fixture-secret')
    expect(await byName('sttApiKey')).toHaveValue('stt-fixture-secret')
  })

  it('exposes only safe provider/model status to regular learners', async () => {
    setup('user')
    expect(
      await screen.findByText('openai/gpt-4o-mini-tts')
    ).toBeInTheDocument()
    expect(screen.getAllByText('missing')).toHaveLength(1)
    expect(screen.queryByLabelText('ttsModel')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('sttApiKey')).not.toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/tts-settings/status', {
      cache: 'no-store',
    })
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/stt-settings/status', {
      cache: 'no-store',
    })
  })

  it('clears the entered key and disallows reuse after the gateway URL changes', async () => {
    setup()
    await byName('sttModel')
    await change('sttApiKey', 'do-not-reuse')
    await change('sttBaseUrl', 'https://another-gateway.example/v1')
    expect(await byName('sttApiKey')).toHaveValue('')
    fireEvent.click(screen.getAllByRole('button', { name: 'save' })[1]!)
    expect(
      screen
        .getAllByRole('alert')
        .some((node) => node.textContent === 'keyRequired')
    ).toBe(true)
  })

  it('refreshes read-only status after canonical voice settings are saved', async () => {
    setup('user')
    await screen.findByText('openai/gpt-4o-mini-tts')
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        response(
          path === '/api/tts-settings/status'
            ? { configured: true, model: ttsSaved.model }
            : path === '/api/stt-settings/status'
              ? { configured: true, model: sttSaved.model }
              : {}
        )
      )
    )
    window.dispatchEvent(new Event('freelingo:voice-settings-saved'))
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/tts-settings/status', {
        cache: 'no-store',
      })
    )
    expect(await screen.findByText(sttSaved.model)).toBeInTheDocument()
  })
})
