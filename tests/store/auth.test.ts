import { describe, it, expect, beforeEach } from 'vitest'
import { isSubscribed, useAuthStore, type User } from '@/store/auth'

describe('isSubscribed', () => {
  const baseUser: User = {
    id: 1,
    username: 'test',
    displayName: 'Test',
    role: 'user',
    conversation_max_duration: 300,
    conversation_inactivity_timeout: 30,
  }

  it('returns true when Stripe is disabled (self-hosted)', () => {
    expect(isSubscribed(null, false)).toBe(true)
    expect(isSubscribed(baseUser, false)).toBe(true)
  })

  it('returns false when Stripe is enabled and user is null', () => {
    expect(isSubscribed(null, true)).toBe(false)
  })

  it.each<{
    name: string
    subscription_status: NonNullable<User['subscription_status']>
    expected: boolean
  }>([
    {
      name: 'returns true for active subscription',
      subscription_status: 'active',
      expected: true,
    },
    {
      name: 'returns true for trialing subscription',
      subscription_status: 'trialing',
      expected: true,
    },
    {
      name: 'returns false for past_due subscription',
      subscription_status: 'past_due',
      expected: false,
    },
    {
      name: 'returns false for canceled subscription',
      subscription_status: 'canceled',
      expected: false,
    },
    {
      name: 'returns false for none subscription',
      subscription_status: 'none',
      expected: false,
    },
  ])('$name', ({ subscription_status, expected }) => {
    const user = { ...baseUser, subscription_status }
    expect(isSubscribed(user, true)).toBe(expected)
  })

  it('returns false when subscription_status is undefined', () => {
    expect(isSubscribed(baseUser, true)).toBe(false)
  })
})

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null })
    localStorage.clear()
  })

  it('setTokens updates accessToken', () => {
    useAuthStore.getState().setTokens('abc123')
    expect(useAuthStore.getState().accessToken).toBe('abc123')
  })

  it('setUser updates user', () => {
    const user: User = {
      id: 1,
      username: 'test',
      displayName: 'Test',
      role: 'user',
      conversation_max_duration: 300,
      conversation_inactivity_timeout: 30,
    }
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('updates the dismissed dashboard banner revision on the current user', () => {
    useAuthStore.setState({ user: { id: 1 } as User })

    useAuthStore.getState().setDismissedDashboardBannerRevision(8)

    expect(
      useAuthStore.getState().user?.dismissed_dashboard_banner_revision
    ).toBe(8)
  })

  it('logout clears token, user, and fl_tour_done from localStorage', () => {
    useAuthStore.setState({ accessToken: 'token', user: { id: 1 } as User })
    localStorage.setItem('fl_tour_done', 'true')

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('fl_tour_done')).toBeNull()
  })
})
