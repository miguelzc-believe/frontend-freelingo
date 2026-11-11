// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { createLandingLoader } from '@/server/landing'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('caches only public data with independent TTLs and never shares session state', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn(async (url: string) =>
    Response.json(url.includes('/config') ? { allow_registration: true } : [])
  )
  vi.stubGlobal('fetch', fetcher)
  const load = createLandingLoader()
  const anonymous = new Request('http://frontend')
  const signedIn = new Request('http://frontend', {
    headers: { cookie: 'refresh_token=fixture' },
  })
  const first = await load(anonymous)
  expect(first.hasSession).toBe(false)
  expect((await load(signedIn)).hasSession).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(300001)
  await load(anonymous)
  expect(fetcher).toHaveBeenCalledTimes(3)
  vi.advanceTimersByTime(3300000)
  await load(anonymous)
  expect(fetcher).toHaveBeenCalledTimes(5)
})
it('does not cache a failed registration request and coalesces concurrent public fetches', async () => {
  const load = createLandingLoader()
  const fetcher = vi.fn(async (url: string) =>
    Response.json(url.includes('/config') ? { allow_registration: true } : [])
  )
  fetcher.mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', fetcher)
  expect((await load(new Request('http://frontend'))).allowRegistration).toBe(
    false
  )
  const result = await Promise.all([
    load(new Request('http://frontend')),
    load(new Request('http://frontend')),
  ])
  expect(result.every((item) => item.allowRegistration)).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it('uses safe defaults for malformed config and review payloads', async () => {
  const fetcher = vi.fn(async (url: string) =>
    Response.json(url.includes('/config') ? null : { items: [] })
  )
  vi.stubGlobal('fetch', fetcher)
  const data = await createLandingLoader()(
    new Request('http://frontend'),
    'http://backend'
  )
  expect(data).toMatchObject({
    hasSession: false,
    allowRegistration: false,
    stripeEnabled: false,
    trialDays: 7,
    priceMonthly: 0,
    priceYearly: 0,
    reviews: [],
  })
})

it('preserves numeric public pricing and rejects nonnumeric configuration', async () => {
  const config = {
    allow_registration: true,
    stripe_enabled: true,
    stripe_trial_days: 14,
    price_monthly: 10,
    price_yearly: 100,
    total_price_monthly: '120',
    total_price_yearly: 110,
  }
  const fetcher = vi.fn(async (url: string) =>
    Response.json(url.includes('/config') ? config : [{ id: 1, rating: 5 }])
  )
  vi.stubGlobal('fetch', fetcher)
  const data = await createLandingLoader()(
    new Request('http://frontend'),
    'http://backend'
  )
  expect(data).toMatchObject({
    allowRegistration: true,
    stripeEnabled: true,
    trialDays: 14,
    priceMonthly: 10,
    priceYearly: 100,
    totalPriceMonthly: 0,
    totalPriceYearly: 110,
    reviews: [{ id: 1, rating: 5 }],
  })
})
