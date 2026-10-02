// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyAnalytics } from '@/server/analytics'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Umami analytics proxy', () => {
  it('returns 404 without contacting upstream when unconfigured', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', '')
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)

    const response = await proxyAnalytics(
      new Request('http://frontend/umami/script.js')
    )

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Umami not configured')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('fetches the configured script URL and returns cached JavaScript', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://stats.example/umami.js?id=site')
    const upstream = vi.fn(async (url: URL) => {
      expect(url.href).toBe('https://stats.example/umami.js?id=site')
      return new Response('window.umami = true', { status: 206 })
    })
    vi.stubGlobal('fetch', upstream)

    const response = await proxyAnalytics(
      new Request('http://frontend/umami/script.js')
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('content-type')).toBe(
      'application/javascript; charset=utf-8'
    )
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=3600'
    )
    expect(await response.text()).toBe('window.umami = true')
  })

  it('strips the proxy prefix and forwards POST data, headers, and signal', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://stats.example/script.js')
    const request = new Request(
      'http://frontend/umami/api/send?website=site&url=%2Flesson',
      {
        method: 'POST',
        body: '{"event":"lesson"}',
        headers: {
          'content-type': 'application/custom+json',
          'user-agent': 'Freelingo test',
          'accept-language': 'es-ES',
        },
      }
    )
    const upstream = vi.fn(async (url: URL, init: RequestInit) => {
      expect(url.href).toBe(
        'https://stats.example/api/send?website=site&url=%2Flesson'
      )
      expect(init.method).toBe('POST')
      expect(init.signal).toBe(request.signal)
      const forwarded = new Request(url, init)
      expect(forwarded.headers.get('content-type')).toBe(
        'application/custom+json'
      )
      expect(forwarded.headers.get('user-agent')).toBe('Freelingo test')
      expect(forwarded.headers.get('accept-language')).toBe('es-ES')
      expect(await forwarded.text()).toBe('{"event":"lesson"}')
      return new Response('{"ok":true}', { status: 202 })
    })
    vi.stubGlobal('fetch', upstream)

    const response = await proxyAnalytics(request)

    expect(response.status).toBe(202)
    expect(await response.text()).toBe('{"ok":true}')
    expect(upstream).toHaveBeenCalledOnce()
  })

  it('uses header defaults for non-POST requests', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://stats.example/script.js')
    const upstream = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.method).toBe('GET')
      expect(init.headers).toEqual({
        'content-type': 'application/json',
        'user-agent': '',
        'accept-language': '*',
      })
      return new Response('ok')
    })
    vi.stubGlobal('fetch', upstream)

    const response = await proxyAnalytics(
      new Request('http://frontend/umami/collect')
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(upstream).toHaveBeenCalledOnce()
  })

  it('maps upstream failures to 502', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://stats.example/script.js')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    const response = await proxyAnalytics(
      new Request('http://frontend/umami/api/send')
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('')
  })
})
