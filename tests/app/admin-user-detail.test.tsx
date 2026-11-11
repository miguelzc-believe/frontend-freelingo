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
    const subscriptionBadge = screen.getByText('statusActive')
    expect(subscriptionBadge).toHaveClass(
      'border-green-500/40',
      'text-green-400'
    )
    expect(subscriptionBadge).not.toHaveClass('inline-flex')
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

    expect(await screen.findAllByText('Ada Admin')).toHaveLength(2)
    expect(screen.getAllByText('inactive')).toHaveLength(2)
    expect(screen.getAllByText('roleAdmin')).toHaveLength(2)
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

    expect(screen.getAllByText('quotaUnlimitedLabel')).toHaveLength(3)
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

  it('rejects invalid quota values without sending an update', async () => {
    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabQuota' }))
    const weeklyInput = screen.getAllByRole('spinbutton')[0]!
    fireEvent.change(weeklyInput, { target: { value: '-1' } })

    const saveButton = screen.getByRole('button', { name: 'quotaSave' })
    expect(weeklyInput.getAttribute('aria-invalid')).toBe('true')
    expect(saveButton).toBeDisabled()
    fireEvent.click(saveButton)
    expect(
      mockApiFetch.mock.calls.some(([, options]) => options?.method === 'PATCH')
    ).toBe(false)
    expect(screen.queryByText('quotaValidationError')).toBeNull()
  })

  it('shows a quota save error and resets its saving state after rejection', async () => {
    let rejectQuotaSave: ((response: Response) => void) | undefined
    mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH')
        return new Promise<Response>((resolve) => {
          rejectQuotaSave = resolve
        })
      if (url.endsWith('/stats')) return Promise.resolve(jsonResponse(stats))
      if (url.endsWith('/quota')) return Promise.resolve(jsonResponse({}))
      return Promise.resolve(jsonResponse(user))
    })

    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabQuota' }))
    fireEvent.click(screen.getByRole('button', { name: 'quotaSave' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'quotaSave' })).toBeDisabled()
    )
    rejectQuotaSave?.(jsonResponse({}, 500))

    expect(await screen.findByText('quotaSaveError')).toBeDefined()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'quotaSave' })).toBeEnabled()
    )
    expect(screen.queryByText('saving')).toBeNull()
  })

  it('saves configured quota limits and refreshes quota usage', async () => {
    const updatedUser = {
      ...user,
      conversation_weekly_sessions: 9,
      conversation_daily_minutes: 15,
      conversation_weekly_minutes: 45,
      monthly_tokens_limit: 2000,
    }
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') return jsonResponse(updatedUser)
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota'))
          return jsonResponse({ sessions_this_week: 2, sessions_limit: 9 })
        return jsonResponse(user)
      }
    )

    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabQuota' }))
    fireEvent.click(screen.getByRole('button', { name: 'quotaSave' }))

    expect(
      await screen.findByRole('button', { name: 'quotaSaved' })
    ).toBeDefined()
    expect(
      screen
        .getAllByRole('spinbutton')
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(['9', '15', '45', '2000'])
    expect(screen.getByText('2 / 9')).toBeDefined()
    const update = mockApiFetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH'
    )
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      conversation_weekly_sessions: 5,
      conversation_daily_minutes: 10,
      conversation_weekly_minutes: 30,
      monthly_tokens_limit: 1000,
    })
  })

  it('keeps the last quota usage if refreshing it after a successful save fails', async () => {
    let quotaRequests = 0
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') return jsonResponse(user)
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) {
          quotaRequests += 1
          return quotaRequests === 1
            ? jsonResponse({ sessions_this_week: 2, sessions_limit: 5 })
            : jsonResponse({}, 503)
        }
        return jsonResponse(user)
      }
    )
    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabQuota' }))
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'quotaSave' }))
    expect(
      await screen.findByRole('button', { name: 'quotaSaved' })
    ).toBeInTheDocument()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('applies a monthly subscription override and sends its active period', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    const updatedUser = { ...user, subscription_status: 'active' }
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
      await screen.findByRole('button', { name: 'tabSubscription' })
    )
    fireEvent.change(
      screen.getByRole('combobox', { name: 'subscriptionOverride' }),
      { target: { value: 'monthly' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'subscriptionConfirm' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    const update = mockApiFetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH'
    )
    expect(update?.[0]).toBe('/api/admin/users/7')
    const payload = JSON.parse(String(update?.[1]?.body)) as {
      subscription_status: string
      subscription_ends_at: string
    }
    expect(payload.subscription_status).toBe('active')
    expect(Date.parse(payload.subscription_ends_at)).toBeGreaterThan(Date.now())
    expect(screen.getAllByText('statusActive').length).toBeGreaterThan(0)
  })

  it.each([
    [null, 'monthly'],
    [new Date(Date.now() + 30 * 86400000).toISOString(), 'monthly'],
    [new Date(Date.now() + 365 * 86400000).toISOString(), 'yearly'],
  ])(
    'infers the current subscription plan from end date %s',
    async (end, expected) => {
      useConfigStore.setState({ stripeEnabled: true })
      mockApiFetch.mockImplementation(async (url: string) => {
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) return jsonResponse({})
        return jsonResponse({
          ...user,
          subscription_status: 'active',
          subscription_ends_at: end,
        })
      })
      render(<AdminUserStatsPage />)
      fireEvent.click(
        await screen.findByRole('button', { name: 'tabSubscription' })
      )
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'subscriptionOverride' })
        ).toHaveValue(expected)
      )
    }
  )

  it('applies a yearly subscription override with a one-year expiry', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH')
          return jsonResponse({
            ...user,
            subscription_ends_at: new Date(
              Date.now() + 365 * 86400000
            ).toISOString(),
          })
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) return jsonResponse({})
        return jsonResponse({
          ...user,
          subscription_status: 'none',
          subscription_ends_at: null,
        })
      }
    )
    render(<AdminUserStatsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'tabSubscription' })
    )
    fireEvent.change(
      screen.getByRole('combobox', { name: 'subscriptionOverride' }),
      { target: { value: 'yearly' } }
    )
    const before = Date.now()
    fireEvent.click(screen.getByRole('button', { name: 'subscriptionConfirm' }))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(
          ([, options]) => options?.method === 'PATCH'
        )
      ).toBe(true)
    )
    const call = mockApiFetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH'
    )
    const payload = JSON.parse(String(call?.[1]?.body)) as {
      subscription_status: string
      subscription_ends_at: string
    }
    expect(payload.subscription_status).toBe('active')
    expect(Date.parse(payload.subscription_ends_at)).toBeGreaterThanOrEqual(
      before + 365 * 86400000
    )
  })

  it('removes a subscription override and reflects the returned user', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    const updatedUser = {
      ...user,
      subscription_status: 'none',
      subscription_ends_at: null,
    }
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
      await screen.findByRole('button', { name: 'tabSubscription' })
    )
    fireEvent.change(
      screen.getByRole('combobox', { name: 'subscriptionOverride' }),
      { target: { value: 'none' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'subscriptionConfirm' }))

    await waitFor(() => expect(screen.getByText('statusNone')).toBeDefined())
    const update = mockApiFetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH'
    )
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      subscription_status: 'none',
      subscription_ends_at: null,
    })
  })

  it('shows a subscription update error and leaves the existing status intact', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') return jsonResponse({}, 503)
        if (url.endsWith('/stats')) return jsonResponse(stats)
        if (url.endsWith('/quota')) return jsonResponse({})
        return jsonResponse(user)
      }
    )
    render(<AdminUserStatsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'tabSubscription' })
    )
    fireEvent.change(
      screen.getByRole('combobox', { name: 'subscriptionOverride' }),
      { target: { value: 'none' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'subscriptionConfirm' }))
    expect(
      await screen.findByText('subscriptionUpdateError')
    ).toBeInTheDocument()
    expect(screen.getAllByText('statusActive').length).toBeGreaterThan(0)
  })

  it.each([
    ['trialing', 'statusTrialing'],
    ['past_due', 'statusPastDue'],
    ['unpaid', 'statusUnpaid'],
    ['paused', 'statusPaused'],
    ['incomplete', 'statusIncomplete'],
    ['incomplete_expired', 'statusIncompleteExpired'],
    ['canceled', 'statusCanceled'],
    ['unknown', 'statusNone'],
  ])('labels subscription status %s', async (status, label) => {
    useConfigStore.setState({ stripeEnabled: true })
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) return jsonResponse(stats)
      if (url.endsWith('/quota')) return jsonResponse({})
      return jsonResponse({ ...user, subscription_status: status })
    })

    render(<AdminUserStatsPage />)

    expect(await screen.findAllByText(label)).not.toHaveLength(0)
  })

  it('shows inactive language and empty token stats without percentages', async () => {
    const sparseStats = {
      ...stats,
      exercises_total: 0,
      tokens_total: 0,
      per_language: [
        {
          target_language: 'xx',
          cefr_level: null,
          xp_total: 0,
          streak_current: 0,
          active_days: 0,
          lessons_completed: 0,
          exercises_correct: 0,
          exercises_total: 0,
        },
      ],
    }
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) return jsonResponse(sparseStats)
      if (url.endsWith('/quota')) return jsonResponse({})
      return jsonResponse(user)
    })

    render(<AdminUserStatsPage />)
    expect(await screen.findByText('statsExercises')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tabLanguages' }))
    expect(screen.getByText('xx')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'tabActivity' }))
    expect(screen.getByText('statsTokensNote')).toBeInTheDocument()
  })

  it('renders active language statistics and token details', async () => {
    const fullStats = {
      ...stats,
      per_language: [
        {
          target_language: 'en-GB',
          cefr_level: 'B1',
          xp_total: 1200,
          streak_current: 3,
          active_days: 4,
          lessons_completed: 5,
          exercises_correct: 7,
          exercises_total: 10,
        },
      ],
    }
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/stats')) return jsonResponse(fullStats)
      if (url.endsWith('/quota')) return jsonResponse({})
      return jsonResponse(user)
    })
    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabLanguages' }))
    expect(screen.getByText(/B1 \/ statsActive/)).toBeInTheDocument()
    expect(screen.getByText(/7\/10 \(70%\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tabActivity' }))
    expect(screen.getByText('statsTokensTotal')).toBeInTheDocument()
    expect(screen.queryByText('statsTokensNote')).not.toBeInTheDocument()
  })

  it('shows empty language statistics when the user has none', async () => {
    render(<AdminUserStatsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'tabLanguages' }))
    expect(screen.getByText('statsNoData')).toBeInTheDocument()
  })
})
