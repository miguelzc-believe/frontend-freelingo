import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type User } from '@/store/auth'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => mocks)
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

import { AiSection } from '@/components/settings/AiSection'
import { AiConfigurationBanner } from '@/components/AiConfigurationBanner'
import type { LlmSettings } from '@/lib/llm-settings'

const saved: LlmSettings = {
  configured: true,
  provider: 'openai',
  model: 'saved-model',
  base_url: null,
  has_api_key: true,
  max_tokens: 8192,
  revision: 1,
}
const empty: LlmSettings = {
  configured: false,
  provider: null,
  model: null,
  base_url: null,
  has_api_key: false,
  max_tokens: 8192,
  revision: 0,
}
const user: User = {
  id: 1,
  role: 'admin',
  username: 'test-admin',
  displayName: 'Test Admin',
  conversation_max_duration: 15,
  conversation_inactivity_timeout: 1,
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(initial: LlmSettings = saved, role: User['role'] = 'admin') {
  useAuthStore.setState({
    user: { ...user, role },
    accessToken: 'test-only-token',
  })
  mocks.apiFetch.mockImplementation((path: string) =>
    Promise.resolve(
      response(
        path === '/api/llm-settings/status'
          ? {
              configured: initial.configured,
              provider: initial.provider,
              model: initial.model,
            }
          : initial
      )
    )
  )
  return render(<AiSection />)
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'save' }))
}

function submitted(path: string) {
  const call = mocks.apiFetch.mock.calls.find(
    ([url, options]) => url === path && options?.body
  )
  return JSON.parse(call?.[1].body as string) as Record<string, unknown>
}

describe('AI settings', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('makes no request and renders no form without authentication', () => {
    render(<AiSection />)
    expect(mocks.apiFetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows only provider and model to regular users using the safe status API', async () => {
    setup(saved, 'user')
    expect(await screen.findByText('saved-model')).toBeInTheDocument()
    expect(screen.getByText('readonly')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('apiKey')).not.toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/llm-settings/status', {
      cache: 'no-store',
    })
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      '/api/admin/llm-settings',
      expect.anything()
    )
  })

  it('tells regular users to contact the administrator when global configuration is empty', async () => {
    setup(empty, 'user')
    expect(await screen.findByRole('status')).toHaveTextContent('missing')
    expect(screen.getByText('readonly')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'save' })
    ).not.toBeInTheDocument()
  })

  it('loads metadata for admins without echoing a saved key', async () => {
    setup()
    const input = await screen.findByLabelText('apiKey')
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByText('keySaved')).toBeInTheDocument()
    expect(screen.getByLabelText('model')).toHaveValue('saved-model')
    expect(screen.getByLabelText('model')).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText('baseUrl')).toHaveAttribute(
      'maxlength',
      '2048'
    )
    expect(screen.queryByLabelText('maxTokens')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('openai')
  })

  it('retains a key for the same provider and normalized URL and clears typed keys on canonical save', async () => {
    setup()
    await screen.findByLabelText('apiKey')
    change('model', '  new-model  ')
    mocks.apiFetch.mockImplementation(() =>
      Promise.resolve(response({ ...saved, model: 'new-model', revision: 2 }))
    )
    save()
    expect(await screen.findByText('saveSuccess')).toBeInTheDocument()
    expect(submitted('/api/admin/llm-settings')).toEqual({
      provider: 'openai',
      model: 'new-model',
      base_url: null,
    })
    change('apiKey', 'test-only-key')
    save()
    await waitFor(() => expect(screen.getByLabelText('apiKey')).toHaveValue(''))
    expect(screen.getByText('keySaved')).toBeInTheDocument()
    expect(screen.getByLabelText('model')).toHaveValue('new-model')
  })

  it('reloads canonical saved metadata on remount without persisting a key in browser state', async () => {
    const view = setup(empty)
    await screen.findByLabelText('apiKey')
    change('provider', 'openai')
    change('model', 'saved-model')
    change('apiKey', 'test-only-key')
    mocks.apiFetch.mockImplementation(() => Promise.resolve(response(saved)))
    save()
    await screen.findByText('saveSuccess')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(JSON.stringify(useAuthStore.getState())).not.toContain(
      'test-only-key'
    )
    view.unmount()
    render(<AiSection />)
    expect(await screen.findByLabelText('apiKey')).toHaveValue('')
    expect(screen.getByLabelText('model')).toHaveValue('saved-model')
  })

  it.each(['provider', 'baseUrl'])(
    'requires a new key after changing %s and never implicitly reuses the old one',
    async (label) => {
      setup()
      await screen.findByLabelText('apiKey')
      change('apiKey', 'draft-key')
      change(
        label,
        label === 'provider' ? 'deepseek' : 'https://example.com/v1'
      )
      expect(screen.getByLabelText('apiKey')).toHaveValue('')
      expect(screen.queryByText('keySaved')).not.toBeInTheDocument()
      save()
      expect(screen.getByRole('alert')).toHaveTextContent('keyRequired')
      expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
      change(label, label === 'provider' ? 'openai' : '')
      save()
      expect(screen.getByRole('alert')).toHaveTextContent('keyRequired')
      expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    }
  )

  it('resets the previous destination and key when switching OpenAI to Anthropic', async () => {
    setup({ ...saved, base_url: 'https://api.openai.com/v1' })
    await screen.findByLabelText('apiKey')
    change('apiKey', 'old-provider-draft-key')
    change('provider', 'anthropic')
    expect(screen.getByLabelText('baseUrl')).toHaveValue('')
    expect(screen.getByLabelText('apiKey')).toHaveValue('')
    expect(screen.queryByText('keySaved')).not.toBeInTheDocument()
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('keyRequired')
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    change('apiKey', 'new-provider-fixture-key')
    change('model', 'anthropic-model')
    mocks.apiFetch.mockResolvedValue(response({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    await screen.findByText('testSuccess')
    expect(submitted('/api/admin/llm-settings/test')).toEqual({
      provider: 'anthropic',
      model: 'anthropic-model',
      base_url: null,
      api_key: 'new-provider-fixture-key',
      max_tokens: 8192,
    })
  })

  it('retains the saved key for whitespace and trailing-slash-only URL changes', async () => {
    setup({ ...saved, base_url: 'https://example.com/v1' })
    await screen.findByLabelText('apiKey')
    change('baseUrl', ' https://example.com/v1/// ')
    mocks.apiFetch.mockResolvedValue(
      response({ ...saved, base_url: 'https://example.com/v1' })
    )
    save()
    await screen.findByText('saveSuccess')
    expect(submitted('/api/admin/llm-settings')).toEqual({
      provider: 'openai',
      model: 'saved-model',
      base_url: 'https://example.com/v1',
    })
  })

  it('explicitly clears a saved key when switching to a key-optional provider', async () => {
    setup()
    await screen.findByLabelText('apiKey')
    change('provider', 'ollama')
    change('model', 'local-model')
    mocks.apiFetch.mockResolvedValue(
      response({
        ...saved,
        provider: 'ollama',
        model: 'local-model',
        has_api_key: false,
      })
    )
    save()
    await screen.findByText('saveSuccess')
    expect(submitted('/api/admin/llm-settings')).toEqual({
      provider: 'ollama',
      model: 'local-model',
      base_url: null,
      clear_api_key: true,
    })
  })

  it('tests the draft without saving and keeps its key and model', async () => {
    setup()
    await screen.findByLabelText('apiKey')
    change('model', 'draft-model')
    change('apiKey', 'test-only-key')
    mocks.apiFetch.mockResolvedValue(response({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    expect(await screen.findByText('testSuccess')).toBeInTheDocument()
    expect(submitted('/api/admin/llm-settings/test')).toEqual({
      provider: 'openai',
      model: 'draft-model',
      base_url: null,
      api_key: 'test-only-key',
    })
    expect(screen.getByLabelText('model')).toHaveValue('draft-model')
    expect(screen.getByLabelText('apiKey')).toHaveValue('test-only-key')
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([, options]) => options?.method === 'PUT'
      )
    ).toHaveLength(0)
  })

  it.each([
    [502, 'testFailed'],
    [504, 'testTimeout'],
    [422, 'validationFailed'],
    [403, 'adminRequired'],
  ])(
    'shows sanitized test errors for HTTP %s and keeps the draft',
    async (status, message) => {
      setup()
      await screen.findByLabelText('apiKey')
      change('apiKey', 'test-only-key')
      mocks.apiFetch.mockResolvedValue(
        response(
          { detail: 'unsafe-provider-detail-test-only-key' },
          status as number
        )
      )
      fireEvent.click(screen.getByRole('button', { name: 'test' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        message as string
      )
      expect(screen.getByLabelText('apiKey')).toHaveValue('test-only-key')
      expect(
        screen.queryByText(/unsafe-provider-detail/)
      ).not.toBeInTheDocument()
    }
  )

  it('keeps edits on a failed save including network failure', async () => {
    setup()
    await screen.findByLabelText('apiKey')
    change('model', 'draft-model')
    change('apiKey', 'test-only-key')
    mocks.apiFetch.mockRejectedValue(new Error('unsafe-provider-detail'))
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('saveFailed')
    expect(screen.getByLabelText('model')).toHaveValue('draft-model')
    expect(screen.getByLabelText('apiKey')).toHaveValue('test-only-key')
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
  })

  it('disables edits and both actions during a request with accessible loading', async () => {
    setup()
    await screen.findByLabelText('apiKey')
    let resolve: (value: Response) => void = () => {
      throw new Error('not initialized')
    }
    mocks.apiFetch.mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r
        })
    )
    save()
    expect(await screen.findByRole('status')).toHaveTextContent('saving')
    expect(screen.getByLabelText('model')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'test' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'saving' })).toBeDisabled()
    resolve(response(saved))
    await screen.findByText('saveSuccess')
    expect(screen.getByLabelText('model')).toBeEnabled()
  })

  it('shows retry instead of an editable empty form when admin loading fails', async () => {
    useAuthStore.setState({ user })
    mocks.apiFetch.mockRejectedValue(new Error('offline'))
    render(<AiSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed')
    expect(screen.queryByLabelText('apiKey')).not.toBeInTheDocument()
    mocks.apiFetch.mockImplementation(() => Promise.resolve(response(saved)))
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByLabelText('model')).toHaveValue('saved-model')
  })

  it('shows a safe status load failure and retry for regular users', async () => {
    useAuthStore.setState({ user: { ...user, role: 'user' } })
    mocks.apiFetch.mockRejectedValue(new Error('offline'))
    render(<AiSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed')
    mocks.apiFetch.mockImplementation(() => Promise.resolve(response(saved)))
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByText('saved-model')).toBeInTheDocument()
  })

  it('validates provider/model, custom URL and Anthropic token count before submitting', async () => {
    setup(empty)
    await screen.findByLabelText('apiKey')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('requiredFields')
    change('provider', 'custom')
    change('model', 'custom-model')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('invalidUrl')
    change('baseUrl', '///')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('invalidUrl')
    change('baseUrl', 'https://user:password@example.com?key=secret')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('invalidUrl')
    change('baseUrl', '')
    change('provider', 'anthropic')
    expect(screen.getByLabelText('maxTokens')).toHaveValue(8192)
    expect(screen.getByLabelText('maxTokens')).toHaveAttribute('max', '131072')
    change('apiKey', 'test-only-key')
    change('maxTokens', '0')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('invalidMaxTokens')
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    change('maxTokens', '131073')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('invalidMaxTokens')
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    change('maxTokens', '131072')
    mocks.apiFetch.mockResolvedValue(
      response({ ...saved, provider: 'anthropic' })
    )
    save()
    await screen.findByText('saveSuccess')
    expect(submitted('/api/admin/llm-settings')).toHaveProperty(
      'max_tokens',
      131072
    )
    change('maxTokens', '')
    mocks.apiFetch.mockResolvedValue(response({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    await screen.findByText('testSuccess')
    expect(submitted('/api/admin/llm-settings/test')).not.toHaveProperty(
      'max_tokens'
    )
  })

  it('allows custom services without a key and preserves /v1 URLs', async () => {
    setup(empty)
    await screen.findByLabelText('apiKey')
    change('provider', 'custom')
    change('model', 'custom-model')
    change('baseUrl', 'https://example.com/v1/')
    mocks.apiFetch.mockResolvedValue(
      response({
        ...saved,
        provider: 'custom',
        base_url: 'https://example.com/v1',
        has_api_key: false,
      })
    )
    save()
    await screen.findByText('saveSuccess')
    expect(submitted('/api/admin/llm-settings')).toEqual({
      provider: 'custom',
      model: 'custom-model',
      base_url: 'https://example.com/v1',
    })
  })

  it('shows the missing-config banner with an AI anchor and removes it after save refresh', async () => {
    setup(empty)
    render(<AiConfigurationBanner />)
    const link = await screen.findByRole('link', { name: 'openSettings' })
    expect(link).toHaveAttribute('href', '/settings#ai')
    expect(screen.getByText('bannerAdmin')).toBeInTheDocument()
    await screen.findByLabelText('apiKey')
    change('provider', 'ollama')
    change('model', 'local-model')
    mocks.apiFetch.mockImplementation(() =>
      Promise.resolve(
        response({ ...saved, provider: 'ollama', model: 'local-model' })
      )
    )
    save()
    await screen.findByText('saveSuccess')
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'openSettings' })
      ).not.toBeInTheDocument()
    )
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([path]) => path === '/api/llm-settings/status'
      )
    ).toHaveLength(2)
  })
})
