interface LandingSubscriptionState {
  subscribed: boolean
  trialUsed: boolean
}

let subscriptionStatusPromise: Promise<LandingSubscriptionState> | null = null

export async function getLandingSubscriptionState(): Promise<LandingSubscriptionState> {
  if (subscriptionStatusPromise) return subscriptionStatusPromise

  subscriptionStatusPromise = (async () => {
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!refreshRes.ok) return { subscribed: false, trialUsed: false }

      const { access_token } = await refreshRes.json()

      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
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
