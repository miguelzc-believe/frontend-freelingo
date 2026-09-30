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
