import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', { href: String(href), ...props }, children),
}))

vi.mock('@/lib/navigation', () => ({
  useParams: () => ({ id: '7' }),
  usePathname: () => '/admin/users/7',
}))

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}))

import AdminUserStatsPage from '@/app/(app)/admin/users/[id]/page'
import { useConfigStore } from '@/store/config'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const user = {
  id: 7,
  username: 'ada',
  display_name: 'Ada',
  email: 'ada@example.com',
  role: 'user',
  native_language: 'en',
  is_active: true,
  is_verified: true,
  subscription_status: 'active',
  subscription_ends_at: '2027-01-01T00:00:00Z',
  stripe_customer_id: 'cus_test',
  conversation_weekly_sessions: 5,
  conversation_daily_minutes: 10,
  conversation_weekly_minutes: 30,
  monthly_tokens_limit: 1000,
}

const stats = {
  user_id: 7,
  current_cefr: 'A1',
  current_unit: null,
  plan_duration_weeks: null,
  completion_test_score: null,
  xp_total: 100,
  streak_current: 2,
  active_days: 3,
  lessons_completed: 4,
  exercises_correct: 8,
  exercises_total: 10,
  chat_messages_sent: 6,
  tokens_total: 20,
  tokens_chat: 12,
  tokens_conversation: 8,
  per_language: [],
}

describe('AdminUserStatsPage subscription visibility', () => {
  beforeEach(() => {
    useConfigStore.setState({ stripeEnabled: false })
    mockApiFetch.mockReset()
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/admin/users/7') return jsonResponse(user)
      if (url === '/api/admin/users/7/stats') return jsonResponse(stats)
      if (url === '/api/admin/users/7/quota') return jsonResponse({})
      return jsonResponse({}, 404)
    })
  })

  it('hides subscription status and controls when Stripe is disabled', async () => {
    useConfigStore.setState({ stripeEnabled: false })

    render(<AdminUserStatsPage />)

    await waitFor(() =>
      expect(screen.getAllByText('Ada').length).toBeGreaterThan(0)
    )
    expect(screen.queryByText('tabSubscription')).toBeNull()
    expect(screen.queryByText('statusActive')).toBeNull()
    expect(screen.queryByText('subscriptionOverride')).toBeNull()
  })

  it('keeps subscription status and controls when Stripe is enabled', async () => {
    useConfigStore.setState({ stripeEnabled: true })

    render(<AdminUserStatsPage />)

    const subscriptionTab = await screen.findByRole('button', {
      name: 'tabSubscription',
    })
    expect(screen.getByText('statusActive')).toBeDefined()
    fireEvent.click(subscriptionTab)
    expect(screen.getByText('subscriptionOverride')).toBeDefined()
    expect(screen.getByText('cus_test')).toBeDefined()
  })

  it('shows the load error when the user request fails', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/users/7'
        ? jsonResponse({}, 500)
        : jsonResponse(url.endsWith('/stats') ? stats : {})
    )

    render(<AdminUserStatsPage />)

    expect(await screen.findByText('loadError')).toBeDefined()
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('shows the load error when the stats request fails', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url.endsWith('/stats')
        ? jsonResponse({}, 503)
        : jsonResponse(url.endsWith('/quota') ? {} : user)
    )

    render(<AdminUserStatsPage />)

    expect(await screen.findByText('loadError')).toBeDefined()
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('shows the load error when a required request rejects', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) throw new Error('network unavailable')
      return jsonResponse(url.endsWith('/quota') ? {} : user)
    })

    render(<AdminUserStatsPage />)

    expect(await screen.findByText('loadError')).toBeDefined()
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('loads profile data without optional email and tolerates quota failure', async () => {
    useConfigStore.setState({ stripeEnabled: false })
    const emailLessAdmin = {
      ...user,
      display_name: 'Ada Admin',
      email: null,
      role: 'admin',
      is_active: false,
      is_verified: false,
    }
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) return jsonResponse(stats)
      if (url.endsWith('/quota')) return jsonResponse({}, 503)
      return jsonResponse(emailLessAdmin)
    })

    render(<AdminUserStatsPage />)

    expect((await screen.findAllByText('Ada Admin')).length).toBe(2)
    expect(screen.getAllByText('inactive').length).toBe(2)
    expect(screen.getAllByText('roleAdmin').length).toBe(2)
    expect(screen.queryByText('ada@example.com')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'tabQuota' }))
    expect(screen.getByText('statsNoData')).toBeDefined()
    expect(screen.getByRole('button', { name: 'quotaSave' })).toBeDefined()
  })

  it('shows unlimited quota usage when quota data loads', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) return jsonResponse(stats)
      if (url.endsWith('/quota'))
        return jsonResponse({
          sessions_this_week: 12,
          sessions_limit: 0,
          sessions_unlimited: true,
          minutes_today: 34,
          minutes_limit: 0,
          time_unlimited: true,
          minutes_this_week: 56,
          weekly_minutes_limit: 0,
          weekly_minutes_unlimited: true,
        })
      return jsonResponse(user)
    })

    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabQuota' }))

    expect(screen.getAllByText('quotaUnlimitedLabel').length).toBe(3)
  })

  it('cancels email verification without sending an update', async () => {
    render(<AdminUserStatsPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'unverifyEmail' })
    )
    expect(screen.getByRole('alertdialog')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mockApiFetch).toHaveBeenCalledTimes(3)
    expect(screen.getByText('emailVerified')).toBeDefined()
  })

  it('updates email verification after confirmation', async () => {
    const updatedUser = { ...user, is_verified: false }
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') return jsonResponse(updatedUser)
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) return jsonResponse({})
        return jsonResponse(user)
      }
    )

    render(<AdminUserStatsPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'unverifyEmail' })
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'unverifyEmail' }).at(-1)!
    )

    await waitFor(() =>
      expect(screen.getByText('emailNotVerified')).toBeDefined()
    )
    const update = mockApiFetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH'
    )
    expect(update?.[0]).toBe('/api/admin/users/7')
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      is_verified: false,
    })
  })

  it('reports a rejected verification update and keeps profile state', async () => {
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') return jsonResponse({}, 500)
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) return jsonResponse({})
        return jsonResponse(user)
      }
    )

    render(<AdminUserStatsPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'unverifyEmail' })
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'unverifyEmail' }).at(-1)!
    )

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('updateUserError')).toBeDefined()
    expect(screen.getByText('emailVerified')).toBeDefined()
  })
})
