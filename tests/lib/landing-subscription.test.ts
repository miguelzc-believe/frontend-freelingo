import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }))

vi.mock('@/lib/session', () => ({
  refreshAccessToken: mocks.refreshAccessToken,
}))

beforeEach(() => {
  vi.resetModules()
  mocks.refreshAccessToken.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing subscription state', () => {
  it('returns an anonymous state without contacting the API when refresh fails', async () => {
    mocks.refreshAccessToken.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { getLandingSubscriptionState, hasActiveLandingSubscription } =
      await import('@/lib/landing-subscription')

    await expect(getLandingSubscriptionState()).resolves.toEqual({
      subscribed: false,
      trialUsed: false,
    })
    await expect(hasActiveLandingSubscription()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.refreshAccessToken).toHaveBeenCalledOnce()
  })

  it('caches the request and recognizes active and trial subscriptions', async () => {
    mocks.refreshAccessToken.mockResolvedValue('memory-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ subscription_status: 'trialing', trial_used: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { getLandingSubscriptionState } =
      await import('@/lib/landing-subscription')

    await expect(getLandingSubscriptionState()).resolves.toEqual({
      subscribed: true,
      trialUsed: true,
    })
    await expect(getLandingSubscriptionState()).resolves.toEqual({
      subscribed: true,
      trialUsed: true,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer memory-token' },
      credentials: 'include',
    })
  })

  it.each([
    { ok: false, json: async () => ({}) },
    { ok: true, json: async () => ({ trial_used: 1 }) },
  ])(
    'falls back safely for non-active or missing subscription status',
    async (response) => {
      mocks.refreshAccessToken.mockResolvedValue('memory-token')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      const { getLandingSubscriptionState } =
        await import('@/lib/landing-subscription')
      await expect(getLandingSubscriptionState()).resolves.toEqual({
        subscribed: false,
        trialUsed: Boolean(response.ok),
      })
    }
  )

  it('returns the safe fallback when refresh, fetch or JSON parsing rejects', async () => {
    mocks.refreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'))
    const { getLandingSubscriptionState } =
      await import('@/lib/landing-subscription')
    await expect(getLandingSubscriptionState()).resolves.toEqual({
      subscribed: false,
      trialUsed: false,
    })

    vi.resetModules()
    mocks.refreshAccessToken.mockResolvedValue('memory-token')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const fetchFailure = await import('@/lib/landing-subscription')
    await expect(fetchFailure.getLandingSubscriptionState()).resolves.toEqual({
      subscribed: false,
      trialUsed: false,
    })

    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => Promise.reject(new Error('invalid json')),
        })
    )
    const jsonFailure = await import('@/lib/landing-subscription')
    await expect(jsonFailure.getLandingSubscriptionState()).resolves.toEqual({
      subscribed: false,
      trialUsed: false,
    })
  })
})
