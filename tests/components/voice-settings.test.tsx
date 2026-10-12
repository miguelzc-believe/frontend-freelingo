import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type User } from '@/store/auth'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => mocks)
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

import { VoiceProviderSettings } from '@/components/settings/VoiceProviderSettings'
import { deferred } from '../helpers/voice-capture'

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
    for (const loading of screen.getAllByRole('status')) {
      expect(loading).toHaveTextContent('loading')
      expect(loading.tagName).toBe('OUTPUT')
      expect(loading).not.toHaveAttribute('role')
      expect(loading).toHaveClass('block')
    }
    expect(await byName('ttsModel')).toHaveValue(ttsSaved.model)
    expect(await byName('sttModel')).toHaveValue(sttSaved.model)
    expect(await byName('ttsBaseUrl')).toHaveValue(ttsSaved.base_url)
    expect(await byName('ttsVoice')).toHaveValue('coral')
    expect(await byName('ttsSpeed')).toHaveValue(1.1)
    expect(await byName('ttsApiKey')).toHaveValue('')
    expect(await byName('sttApiKey')).toHaveValue('')
    expect(await byName('ttsApiKey')).toHaveAttribute('type', 'password')
    expect(screen.getAllByText('keySaved')).toHaveLength(2)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(2)
    expect(statuses[0]).toHaveTextContent(ttsSaved.model)
    for (const status of statuses) {
      expect(status.tagName).toBe('OUTPUT')
      expect(status).not.toHaveAttribute('role')
      expect(status).toHaveClass('block')
    }
  })

  it('uses the OmniRoute default URL and validates each draft before saving', async () => {
    const view = setup('admin', { tts: missing, stt: missing })
    expect(await byName('ttsBaseUrl')).toHaveValue(
      'https://omniroute.miguel-zapata.com/v1'
    )
    expect(await byName('ttsSpeed')).toHaveValue(1)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(2)
    for (const status of statuses) {
      expect(status).toHaveTextContent('missing')
      expect(status.tagName).toBe('OUTPUT')
      expect(status).not.toHaveAttribute('role')
      expect(status).toHaveClass('block')
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'save' })[0]!)
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('required')
    expect(error.tagName).toBe('OUTPUT')
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
    const success = await screen.findByText('saveSuccess')
    expect(screen.getAllByRole('status')).toContain(success)
    expect(success.tagName).toBe('OUTPUT')
    expect(success).not.toHaveAttribute('role')
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

  it.each([
    ['save', 'saving', sttSaved, 'saveSuccess'],
    ['test', 'testing', { ok: true }, 'testSuccess'],
  ] as const)(
    'announces STT %s progress with native status semantics',
    async (action, progress, result, success) => {
      setup()
      await byName('sttModel')
      let resolve: (value: Response) => void = () => {
        throw new Error('not initialized')
      }
      mocks.apiFetch.mockImplementation(
        () =>
          new Promise<Response>((r) => {
            resolve = r
          })
      )
      fireEvent.click(screen.getAllByRole('button', { name: action })[1]!)
      const loading = screen.getByText(progress, { selector: 'output' })
      expect(screen.getAllByRole('status')).toContain(loading)
      expect(loading.tagName).toBe('OUTPUT')
      expect(loading).not.toHaveAttribute('role')
      expect(loading).toHaveClass('block')
      expect(await byName('sttModel')).toBeDisabled()
      resolve(response(result))
      expect(await screen.findByText(success)).toBeInTheDocument()
      expect(await byName('sttModel')).toBeEnabled()
    }
  )

  it('plays a TTS test sample preserving binary audio bytes including values above 127', async () => {
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
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:voice-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    try {
      setup()
      await byName('ttsModel')
      mocks.apiFetch.mockImplementation((path: string) =>
        Promise.resolve(
          response(
            path.endsWith('/test')
              ? {
                  ok: true,
                  audio_base64: 'AH+A/w==',
                  content_type: 'audio/mpeg',
                }
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
      expect(createObjectURL).toHaveBeenCalledOnce()
      const blob = createObjectURL.mock.calls[0]?.[0]
      expect(blob).toBeInstanceOf(Blob)
      if (!(blob instanceof Blob)) throw new Error('Expected an audio Blob')
      expect(blob.type).toBe('audio/mpeg')
      expect(blob.size).toBe(4)
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(reader.result)
          else reject(new Error('Expected binary audio data'))
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
      })
      expect(Array.from(new Uint8Array(buffer))).toEqual([0, 127, 128, 255])
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
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
    const loadingStatuses = screen.getAllByRole('status')
    expect(loadingStatuses).toHaveLength(2)
    for (const loading of loadingStatuses) {
      expect(loading).toHaveTextContent('loading')
      expect(loading.tagName).toBe('OUTPUT')
      expect(loading).not.toHaveAttribute('role')
      expect(loading).toHaveClass('block')
    }
    expect(
      await screen.findByText('openai/gpt-4o-mini-tts')
    ).toBeInTheDocument()
    const missingStatus = await screen.findByText('missing')
    expect(screen.getByRole('status')).toBe(missingStatus)
    expect(missingStatus).toHaveTextContent('missing')
    expect(missingStatus.tagName).toBe('OUTPUT')
    expect(missingStatus).not.toHaveAttribute('role')
    expect(missingStatus).toHaveClass('block')
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

  it('keeps failed read-only status requests as alerts rather than status outputs', async () => {
    useAuthStore.setState({ user: learner, accessToken: 'test' })
    mocks.apiFetch.mockRejectedValue(new Error('offline'))
    render(<VoiceProviderSettings />)
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    for (const alert of alerts) expect(alert).toHaveTextContent('loadFailed')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['tts', 'stt'] as const)(
    'retries a failed read-only %s status without requesting admin settings',
    async (kind) => {
      useAuthStore.setState({ user: learner, accessToken: 'test' })
      mocks.apiFetch.mockRejectedValue(new Error('offline'))
      render(<VoiceProviderSettings />)
      expect(await screen.findAllByRole('alert')).toHaveLength(2)
      const section = screen.getByRole('heading', { name: kind }).parentElement!
      mocks.apiFetch.mockResolvedValue(response({ configured: false }))
      fireEvent.click(within(section).getByRole('button', { name: 'retry' }))
      expect(await within(section).findByRole('status')).toHaveTextContent(
        'missing'
      )
      expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(section).queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(mocks.apiFetch).toHaveBeenCalledTimes(3)
      expect(mocks.apiFetch).toHaveBeenLastCalledWith(
        `/api/${kind}-settings/status`,
        { cache: 'no-store' }
      )
    }
  )

  it.each([true, false])(
    'preserves read-only voice status after a failed refresh with configured=%s',
    async (configured) => {
      useAuthStore.setState({ user: learner, accessToken: 'test' })
      const initialStatus = deferred<void>()
      mocks.apiFetch.mockImplementation(async (path: string) => {
        await initialStatus.promise
        const saved = path === '/api/tts-settings/status' ? ttsSaved : sttSaved
        return response({ ...saved, configured })
      })
      render(<VoiceProviderSettings />)
      await act(async () => {
        initialStatus.resolve()
      })
      mocks.apiFetch.mockRejectedValue(new Error('offline'))
      await act(async () => {
        window.dispatchEvent(new Event('freelingo:voice-settings-saved'))
      })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByText('loading')).not.toBeInTheDocument()
      expect(mocks.apiFetch).toHaveBeenCalledTimes(4)
      if (!configured) {
        expect(screen.getAllByRole('status')).toHaveLength(2)
        for (const status of screen.getAllByRole('status')) {
          expect(status).toHaveTextContent('missing')
          expect(status.tagName).toBe('OUTPUT')
        }
        return
      }
      expect(screen.getByText(ttsSaved.model)).toBeInTheDocument()
      expect(screen.getByText(sttSaved.model)).toBeInTheDocument()
      expect(screen.getAllByText('configured')).toHaveLength(2)
      const ttsSection = screen.getByRole('heading', {
        name: 'tts',
      }).parentElement!
      const sttSection = screen.getByRole('heading', {
        name: 'stt',
      }).parentElement!
      expect(within(ttsSection).getByText('voice')).toBeInTheDocument()
      expect(within(sttSection).queryByText('voice')).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }
  )

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
