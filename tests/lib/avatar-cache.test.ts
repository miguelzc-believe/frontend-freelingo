import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAvatarCache,
  loadAvatar,
  subscribeAvatar,
} from '@/lib/avatar-cache'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/lib/session', () => ({ refreshAccessToken: mocks.refresh }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('avatar cache', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let create: ReturnType<typeof vi.fn>
  let revoke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearAvatarCache()
    mocks.refresh.mockReset()
    fetchMock = vi.fn()
    create = vi.fn().mockReturnValue('blob:avatar')
    revoke = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, {
        createObjectURL: create,
        revokeObjectURL: revoke,
      })
    )
  })

  afterEach(() => {
    clearAvatarCache()
    vi.unstubAllGlobals()
  })

  it('delivers inline avatars without a request and notifies subscribers on clear', async () => {
    const subscriber = vi.fn()
    const unsubscribe = subscribeAvatar(subscriber)
    expect(subscriber).toHaveBeenLastCalledWith(null)
    expect(await loadAvatar('data:image/png;base64,abc', null)).toBe(
      'data:image/png;base64,abc'
    )
    expect(await loadAvatar('data:image/png;base64,abc', null)).toBe(
      'data:image/png;base64,abc'
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(subscriber).toHaveBeenLastCalledWith('data:image/png;base64,abc')
    clearAvatarCache()
    expect(subscriber).toHaveBeenLastCalledWith(null)
    unsubscribe()
    const calls = subscriber.mock.calls.length
    await loadAvatar('data:image/png;base64,xyz', null)
    expect(subscriber).toHaveBeenCalledTimes(calls)
    expect(revoke).not.toHaveBeenCalled()
  })

  it('coalesces in-flight requests, caches blobs and revokes replaced URLs', async () => {
    const request = deferred<Response>()
    fetchMock.mockReturnValueOnce(request.promise)
    const first = loadAvatar('/avatar.png', 'token')
    const second = loadAvatar('/avatar.png', 'token')
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me/avatar-file', {
      headers: { Authorization: 'Bearer token' },
      credentials: 'include',
    })
    request.resolve(new Response(new Blob(['avatar'])))
    expect(await first).toBe('blob:avatar')
    expect(await loadAvatar('/avatar.png', 'token')).toBe('blob:avatar')
    expect(fetchMock).toHaveBeenCalledOnce()
    await loadAvatar('data:image/png;base64,new', null)
    expect(revoke).toHaveBeenCalledWith('blob:avatar')
  })

  it('retries unauthorized avatar requests with the refreshed access token', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(new Blob(['image'])))
    mocks.refresh.mockResolvedValueOnce('fresh')
    expect(await loadAvatar('/avatar.png', 'expired')).toBe('blob:avatar')
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/me/avatar-file', {
      headers: { Authorization: 'Bearer fresh' },
      credentials: 'include',
    })
  })

  it.each(['no-token', 'refresh-failed', 'request-failed', 'network-error'])(
    'returns no avatar for %s without exposing a broken URL',
    async (scenario) => {
      if (scenario === 'network-error')
        fetchMock.mockRejectedValueOnce(new Error('offline'))
      else
        fetchMock.mockResolvedValueOnce(
          new Response(null, {
            status: scenario === 'request-failed' ? 500 : 401,
          })
        )
      mocks.refresh.mockResolvedValueOnce(null)
      expect(
        await loadAvatar(
          '/avatar.png',
          scenario === 'no-token' ? null : 'token'
        )
      ).toBeNull()
      expect(create).not.toHaveBeenCalled()
      expect(mocks.refresh).toHaveBeenCalledTimes(
        scenario === 'refresh-failed' ? 1 : 0
      )
      if (scenario === 'no-token')
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/me/avatar-file', {
          headers: {},
          credentials: 'include',
        })
    }
  )

  it('ignores an old blob response after switching avatars', async () => {
    const request = deferred<Response>()
    fetchMock.mockReturnValueOnce(request.promise)
    const old = loadAvatar('/old.png', 'token')
    await loadAvatar('data:image/png;base64,new', null)
    request.resolve(new Response(new Blob(['old'])))
    expect(await old).toBeNull()
    expect(create).not.toHaveBeenCalled()
    const subscriber = vi.fn()
    const unsubscribe = subscribeAvatar(subscriber)
    expect(subscriber).toHaveBeenCalledWith('data:image/png;base64,new')
    unsubscribe()
  })
})
