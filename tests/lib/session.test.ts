import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshAccessToken } from '@/lib/session'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null })
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('shared refresh-cookie rotation', () => {
  it('shares one cold-session request between concurrent initializations', async () => {
    let complete: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const first = refreshAccessToken()
    const second = refreshAccessToken()
    expect(second).toBe(first)
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    complete?.(Response.json({ access_token: 'restored' }))
    await expect(Promise.all([first, second])).resolves.toEqual([
      'restored',
      'restored',
    ])
    expect(useAuthStore.getState().accessToken).toBe('restored')
  })

  it('shares a renewal with a simultaneous unauthorized API retry', async () => {
    useAuthStore.setState({ accessToken: 'expired' })
    let complete: ((response: Response) => void) | undefined
    let rotations = 0
    vi.mocked(fetch).mockImplementation((url, options) => {
      if (url === '/api/auth/refresh') {
        rotations += 1
        return new Promise((resolve) => {
          complete = resolve
        })
      }
      return Promise.resolve(
        new Response(null, {
          status:
            new Headers(options?.headers).get('Authorization') ===
            'Bearer restored'
              ? 200
              : 401,
        })
      )
    })
    const initialization = refreshAccessToken()
    const request = apiFetch('/api/protected')
    await vi.waitFor(() => expect(rotations).toBe(1))
    complete?.(Response.json({ access_token: 'restored' }))
    expect(await initialization).toBe('restored')
    expect((await request).status).toBe(200)
    expect(rotations).toBe(1)
  })

  it('allows a later attempt after failure and rejects malformed token payloads', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ access_token: 123 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'valid' }))
    expect(await refreshAccessToken()).toBeNull()
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(await refreshAccessToken()).toBe('valid')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
