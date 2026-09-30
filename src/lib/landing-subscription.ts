import { refreshAccessToken } from '@/lib/session'

interface LandingSubscriptionState {
  subscribed: boolean
  trialUsed: boolean
}

let subscriptionStatusPromise: Promise<LandingSubscriptionState> | null = null

export async function getLandingSubscriptionState(): Promise<LandingSubscriptionState> {
  if (subscriptionStatusPromise) return subscriptionStatusPromise

  subscriptionStatusPromise = (async () => {
    try {
      const token = await refreshAccessToken()
      if (!token) return { subscribed: false, trialUsed: false }

      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      if (!meRes.ok) return { subscribed: false, trialUsed: false }

      const me = await meRes.json()
      const status: string = me.subscription_status ?? 'none'
      return {
        subscribed: status === 'active' || status === 'trialing',
        trialUsed: Boolean(me.trial_used),
      }
    } catch {
      return { subscribed: false, trialUsed: false }
    }
  })()

  return subscriptionStatusPromise
}

export async function hasActiveLandingSubscription(): Promise<boolean> {
  const state = await getLandingSubscriptionState()
  return state.subscribed
}
