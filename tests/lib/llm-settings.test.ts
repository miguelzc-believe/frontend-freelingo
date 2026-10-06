import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => mocks)

import {
  fetchLlmSettings,
  fetchLlmStatus,
  isValidLlmBaseUrl,
  LlmSettingsApiError,
  normalizeLlmBaseUrl,
  saveLlmSettings,
  testLlmSettings,
  type LlmSettingsInput,
} from '@/lib/llm-settings'

const canonical = {
  configured: true,
  provider: 'openai',
  model: 'test-model',
  base_url: null,
  has_api_key: true,
  max_tokens: 8192,
  revision: 3,
}
const input: LlmSettingsInput = {
  provider: 'openai',
  model: 'test-model',
  base_url: null,
  api_key: 'test-only-key',
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('LLM settings API', () => {
  beforeEach(() => mocks.apiFetch.mockReset())

  it('fetches uncached authenticated status and allowlists its safe fields', async () => {
    mocks.apiFetch.mockResolvedValue(
      response({ ...canonical, api_key: 'unexpected' })
    )
    expect(await fetchLlmStatus()).toEqual({
      configured: true,
      provider: 'openai',
      model: 'test-model',
    })
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/llm-settings/status', {
      cache: 'no-store',
    })
  })

  it('fetches admin metadata without carrying any unexpected key field', async () => {
    mocks.apiFetch.mockResolvedValue(
      response({ ...canonical, api_key: 'unexpected' })
    )
    expect(await fetchLlmSettings()).toEqual(canonical)
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/admin/llm-settings', {
      cache: 'no-store',
    })
  })

  it('saves with JSON same-origin transport and emits a secret-free refresh event', async () => {
    mocks.apiFetch.mockImplementation(() =>
      Promise.resolve(response(canonical))
    )
    const listener = vi.fn()
    window.addEventListener('freelingo:llm-settings-saved', listener)
    try {
      expect(await saveLlmSettings(input)).toEqual(canonical)
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/admin/llm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      expect(listener).toHaveBeenCalledOnce()
      expect(listener.mock.calls[0]?.[0]).not.toHaveProperty('detail')
    } finally {
      window.removeEventListener('freelingo:llm-settings-saved', listener)
    }
  })

  it('tests a draft without saving or dispatching a saved event', async () => {
    mocks.apiFetch.mockResolvedValue(response({ ok: true }))
    const listener = vi.fn()
    window.addEventListener('freelingo:llm-settings-saved', listener)
    try {
      expect(await testLlmSettings(input)).toEqual({ ok: true })
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/admin/llm-settings/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      )
      expect(listener).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('freelingo:llm-settings-saved', listener)
    }
  })

  it('preserves omission and explicit clear semantics', async () => {
    mocks.apiFetch.mockImplementation(() =>
      Promise.resolve(response(canonical))
    )
    const withoutKey: LlmSettingsInput = {
      provider: 'openai',
      model: 'new-model',
      base_url: null,
    }
    await saveLlmSettings(withoutKey)
    expect(
      JSON.parse(mocks.apiFetch.mock.calls[0]?.[1].body as string)
    ).not.toHaveProperty('api_key')
    await saveLlmSettings({ ...withoutKey, clear_api_key: true })
    expect(
      JSON.parse(mocks.apiFetch.mock.calls[1]?.[1].body as string)
    ).toHaveProperty('clear_api_key', true)
  })

  it.each([403, 422, 502, 504])(
    'returns only a status-based error for HTTP %s',
    async (status) => {
      const json = vi.fn()
      mocks.apiFetch.mockResolvedValue({ ok: false, status, json })
      await expect(testLlmSettings(input)).rejects.toEqual(
        new LlmSettingsApiError(status)
      )
      expect(json).not.toHaveBeenCalled()
    }
  )

  it('does not emit save refresh after failure', async () => {
    mocks.apiFetch.mockResolvedValue(
      response({ detail: 'secret-containing-error' }, 502)
    )
    const listener = vi.fn()
    window.addEventListener('freelingo:llm-settings-saved', listener)
    try {
      await expect(saveLlmSettings(input)).rejects.toThrow(
        'llm_settings_api_error_502'
      )
      expect(listener).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('freelingo:llm-settings-saved', listener)
    }
  })

  it.each([
    'http://host.docker.internal:11434',
    'http://localhost:11434/v1',
    'https://example.com/api/v1',
  ])('accepts an HTTP(S) base URL: %s', (url) => {
    expect(isValidLlmBaseUrl(url)).toBe(true)
  })

  it.each([
    'not a URL',
    'file:///tmp/key',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://user@example.com',
    'https://example.com?key=secret',
    'https://example.com#secret',
    'https://example.com?',
    'https://example.com#',
  ])('rejects unsafe base URL: %s', (url) => {
    expect(isValidLlmBaseUrl(url)).toBe(false)
  })

  it('normalizes whitespace and trailing slashes without stripping /v1', () => {
    expect(normalizeLlmBaseUrl(' https://example.com/v1/// ')).toBe(
      'https://example.com/v1'
    )
    expect(normalizeLlmBaseUrl(' ')).toBeNull()
    expect(normalizeLlmBaseUrl(null)).toBeNull()
  })
})
