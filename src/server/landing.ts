import type { ReviewPublic } from '@/types/api'
import { readCookie } from './locale'

export interface LandingData {
  hasSession: boolean
  allowRegistration: boolean
  stripeEnabled: boolean
  trialDays: number
  priceMonthly: number
  priceYearly: number
  totalPriceMonthly: number
  totalPriceYearly: number
  reviews: ReviewPublic[]
}
export const defaultLanding: LandingData = {
  hasSession: false,
  allowRegistration: false,
  stripeEnabled: false,
  trialDays: 7,
  priceMonthly: 0,
  priceYearly: 0,
  totalPriceMonthly: 0,
  totalPriceYearly: 0,
  reviews: [],
}
interface CachedValue {
  expires: number
  value: unknown
}
// Only anonymous public responses are cached; session and locale remain per request.
export function createLandingLoader() {
  const cache = new Map<string, CachedValue>()
  const pending = new Map<string, Promise<unknown>>()
  async function get(url: string, ttl: number): Promise<unknown> {
    const cached = cache.get(url)
    if (cached && cached.expires > Date.now()) return cached.value
    const inFlight = pending.get(url)
    if (inFlight) return inFlight
    const promise = fetch(url, { signal: AbortSignal.timeout(5000) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Public data unavailable')
        const value: unknown = await response.json()
        cache.set(url, { value, expires: Date.now() + ttl })
        return value
      })
      .finally(() => pending.delete(url))
    pending.set(url, promise)
    return promise
  }
  return async (
    request: Request,
    base = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
  ): Promise<LandingData> => {
    const [config, reviews] = await Promise.all([
      get(`${base}/api/config`, 3600000).catch(() => ({})),
      get(`${base}/api/reviews/public?limit=100`, 300000).catch(() => []),
    ])
    const cfg =
      config && typeof config === 'object'
        ? (config as Record<string, unknown>)
        : {}
    const number = (key: string, fallback = 0) =>
      typeof cfg[key] === 'number' ? cfg[key] : fallback
    return {
      hasSession: readCookie(request, 'refresh_token') !== undefined,
      allowRegistration: cfg.allow_registration === true,
      stripeEnabled: cfg.stripe_enabled === true,
      trialDays: number('stripe_trial_days', 7),
      priceMonthly: number('price_monthly'),
      priceYearly: number('price_yearly'),
      totalPriceMonthly: number('total_price_monthly'),
      totalPriceYearly: number('total_price_yearly'),
      reviews: Array.isArray(reviews) ? (reviews as ReviewPublic[]) : [],
    }
  }
}
export const loadLanding = createLandingLoader()
