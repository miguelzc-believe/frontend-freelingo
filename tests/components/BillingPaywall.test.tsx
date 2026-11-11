import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const localeState = vi.hoisted(() => ({ value: 'en' }))

vi.mock('use-intl', () => ({
  useLocale: () => localeState.value,
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

vi.mock('@/components/tour/OnboardingTour', () => ({
  default: () => null,
}))

vi.mock('@/components/whats-new/WhatsNew', () => ({
  default: () => null,
}))

vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label }: { label: string }) => <div>{label}</div>,
}))

const { mockApiFetch, mockLandingSubscriptionState, mockRefresh } = vi.hoisted(
  () => ({
    mockApiFetch: vi.fn(),
    mockLandingSubscriptionState: vi.fn(),
    mockRefresh: vi.fn(),
  })
)

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}))

vi.mock('@/lib/landing-subscription', () => ({
  getLandingSubscriptionState: mockLandingSubscriptionState,
}))
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  refreshAccessToken: mockRefresh,
}))

import PricingSection from '@/components/billing/PricingSection'
import { PaywallBanner } from '@/components/billing/PaywallBanner'
import { BillingSection } from '@/components/settings/BillingSection'
import DashboardPage from '@/app/(app)/dashboard/page'
import { useAuthStore, type User } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useLanguageStore } from '@/store/language'
import { useProgressStore } from '@/store/progress'
import { getLanguageByCode } from '@/lib/target-languages'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'learner',
    displayName: 'Learner',
    email: 'learner@example.com',
    native_language: 'es',
    ui_locale: 'en',
    role: 'user' as const,
    conversation_max_duration: 30,
    conversation_inactivity_timeout: 10,
    avatar: null,
    is_verified: true,
    bio: null,
    learning_goals: [],
    subscription_status: 'none',
    subscription_ends_at: null,
    trial_used: false,
    ...overrides,
  }
}

function resetStores() {
  useAuthStore.setState({ accessToken: 'token', user: user() })
  useConfigStore.setState({
    stripeEnabled: true,
    stripeTrialDays: 7,
    ttsProvider: 'local',
    openaiTtsVoice: 'nova',
    maintenanceMode: false,
    priceMonthly: 9.99,
    priceYearly: 99.99,
    totalPriceMonthly: 119.88,
    totalPriceYearly: 99.99,
    loaded: true,
  })
  useLanguageStore.setState({
    activeLanguage: getLanguageByCode('en-GB') ?? null,
    userLanguages: [],
    supportedLanguages: [],
    availableLanguageCodes: [],
    isSwitching: false,
  })
  useProgressStore.setState({
    streak: 0,
    xp: 0,
    skills: {},
    todayLessons: [],
    completedToday: [],
    currentUnitId: '',
    currentPlanDurationWeeks: 12,
    unitProgress: {},
    levelTestUnlocked: false,
    levelTestResult: null,
  })
}

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'location'
)

afterEach(() => {
  if (originalLocationDescriptor) {
    Object.defineProperty(window, 'location', originalLocationDescriptor)
  }
})

beforeEach(() => {
  localeState.value = 'en'
  mockApiFetch.mockReset()
  mockLandingSubscriptionState.mockReset()
  mockRefresh.mockReset()
  resetStores()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: vi.fn() },
  })
})

describe('billing paywall UI', () => {
  it.each([
    { compact: false, recovery: false },
    { compact: true, recovery: false },
    { compact: false, recovery: true },
    { compact: true, recovery: true },
  ])(
    'retains button identity and focus on parent rerender (compact=$compact, recovery=$recovery)',
    ({ compact, recovery }) => {
      if (recovery) {
        useAuthStore.setState({
          user: user({ subscription_status: 'past_due' }),
        })
      }
      const view = render(<PaywallBanner compact={compact} />)
      const action = screen.getByRole('button', {
        name: recovery ? 'updatePayment' : 'planYearly',
      })
      action.focus()
      expect(action).toHaveFocus()

      view.rerender(<PaywallBanner compact={compact} />)

      expect(
        screen.getByRole('button', {
          name: recovery ? 'updatePayment' : 'planYearly',
        })
      ).toBe(action)
      expect(action).toHaveFocus()
      expect(mockApiFetch).not.toHaveBeenCalled()
    }
  )

  it('formats the subscription end date with the selected interface locale', () => {
    localeState.value = 'fi'
    useAuthStore.setState({
      user: user({
        subscription_status: 'canceled',
        subscription_ends_at: '2099-09-24T12:00:00Z',
      }),
    })

    render(<BillingSection />)

    expect(screen.getByText('24.9.2099')).toBeInTheDocument()
  })

  it('opens Customer Portal for past_due users in Settings instead of showing plan buttons', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'past_due' }),
    })
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ url: 'https://billing.stripe.com/session/test' })
    )

    render(<BillingSection />)

    expect(screen.getByText('pastDueTitle')).toBeDefined()
    expect(screen.getByText('pastDueDesc')).toBeDefined()
    expect(screen.queryByText('planMonthly')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/test'
    )
  })

  it('opens Customer Portal for unpaid users in Settings instead of showing plan buttons', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'unpaid' }),
    })
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ url: 'https://billing.stripe.com/session/unpaid' })
    )

    render(<BillingSection />)

    expect(screen.getByText('statusUnpaid')).toBeDefined()
    expect(screen.getByText('pastDueTitle')).toBeDefined()
    expect(screen.queryByText('planMonthly')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/unpaid'
    )
  })

  it('opens Customer Portal for paused users in Settings instead of showing plan buttons', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'paused' }),
    })
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ url: 'https://billing.stripe.com/session/paused' })
    )

    render(<BillingSection />)

    expect(screen.getByText('statusPaused')).toBeDefined()
    expect(screen.getByText('pastDueTitle')).toBeDefined()
    expect(screen.queryByText('planMonthly')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/paused'
    )
  })

  it('shows subscription plan buttons for canceled users in Settings', () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'canceled' }),
    })

    render(<BillingSection />)

    expect(screen.getByText('statusCanceled')).toBeDefined()
    expect(screen.getByText('planMonthly')).toBeDefined()
    expect(screen.getByText('planYearly')).toBeDefined()
    expect(screen.queryByText('updatePayment')).toBeNull()
  })

  it.each(['incomplete', 'incomplete_expired'] as const)(
    'shows subscription plan buttons for %s users in Settings',
    (subscriptionStatus) => {
      useAuthStore.setState({
        accessToken: 'token',
        user: user({ subscription_status: subscriptionStatus }),
      })

      render(<BillingSection />)

      expect(
        screen.getByText(
          subscriptionStatus === 'incomplete'
            ? 'statusIncomplete'
            : 'statusIncompleteExpired'
        )
      ).toBeDefined()
      expect(screen.getByText('planMonthly')).toBeDefined()
      expect(screen.getByText('planYearly')).toBeDefined()
      expect(screen.queryByText('updatePayment')).toBeNull()
    }
  )

  it('shows subscription plan buttons for users without a subscription in Settings', () => {
    render(<BillingSection />)

    expect(screen.getByText('planMonthly')).toBeDefined()
    expect(screen.getByText('planYearly')).toBeDefined()
    expect(screen.queryByText('pastDueTitle')).toBeNull()
  })

  it.each([
    ['active', false, 'statusActive', 'nextBilling'],
    ['active', true, 'statusCanceling', 'accessUntil'],
    ['trialing', false, 'statusTrialing', 'nextBilling'],
    ['past_due', false, 'statusPastDue', 'nextBilling'],
    ['unpaid', false, 'statusUnpaid', 'nextBilling'],
    ['paused', false, 'statusPaused', 'nextBilling'],
    ['canceled', false, 'statusCanceled', 'accessUntil'],
  ] as const)(
    'renders %s billing dates and status (cancel=%s)',
    (status, cancel, label, dateLabel) => {
      useAuthStore.setState({
        user: user({
          subscription_status: status,
          cancel_at_period_end: cancel,
          subscription_ends_at: '2099-09-24T12:00:00Z',
        }),
      })
      render(<BillingSection />)
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(screen.getByText(dateLabel)).toBeInTheDocument()
    }
  )

  it('does not show an expired billing date and recovers from portal errors', async () => {
    useAuthStore.setState({
      user: user({
        subscription_status: 'active',
        subscription_ends_at: '2020-01-01T00:00:00Z',
      }),
    })
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}, 503))
    render(<BillingSection />)
    expect(screen.queryByText('nextBilling')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'manage' }))
    expect(await screen.findByText('portalError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'manage' })).toBeEnabled()
  })

  it('uses payment-recovery copy and portal action for past_due users on dashboard', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'past_due' }),
    })
    mockApiFetch
      .mockResolvedValueOnce(
        jsonResponse({
          current_streak: 0,
          total_xp: 0,
          skills: {},
          total_lessons: 0,
          total_exercises: 0,
          exercises_correct: 0,
          accuracy: 0,
          vocabulary_level: null,
          vocabulary_mastered: 0,
          vocabulary_total: 0,
          vocabulary_progress: 0,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          cefr_level: 'A1',
          progress_day: 0,
          total_days: 7,
          pending_count: 0,
          lessons: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ url: 'https://billing.stripe.com/session/dashboard' })
      )

    render(<DashboardPage />)

    await waitFor(() =>
      expect(screen.getByText('premiumBannerPastDueTitle')).toBeDefined()
    )
    expect(screen.getByText('premiumBannerPastDueDesc')).toBeDefined()
    expect(screen.queryByText('planMonthly')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenLastCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/dashboard'
    )
  })

  it('uses payment-recovery copy and portal action for paused users on dashboard', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'paused' }),
    })
    mockApiFetch
      .mockResolvedValueOnce(
        jsonResponse({
          current_streak: 0,
          total_xp: 0,
          skills: {},
          total_lessons: 0,
          total_exercises: 0,
          exercises_correct: 0,
          accuracy: 0,
          vocabulary_level: null,
          vocabulary_mastered: 0,
          vocabulary_total: 0,
          vocabulary_progress: 0,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          cefr_level: 'A1',
          progress_day: 0,
          total_days: 7,
          pending_count: 0,
          lessons: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ url: 'https://billing.stripe.com/session/paused' })
      )

    render(<DashboardPage />)

    await waitFor(() =>
      expect(screen.getByText('premiumBannerPastDueTitle')).toBeDefined()
    )
    expect(screen.queryByText('planMonthly')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenLastCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/paused'
    )
  })

  it('submits yearly PaywallBanner checkout, disables both plans while pending, then redirects', async () => {
    let resolveCheckout!: (response: Response) => void
    mockApiFetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveCheckout = resolve
      })
    )

    render(<PaywallBanner />)

    const [yearlyButton] = screen.getAllByRole('button')
    fireEvent.click(yearlyButton!)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'yearly' }),
    })
    await waitFor(() => {
      const [yearlyPending, monthlyPending] = screen.getAllByRole('button')
      expect(yearlyPending).toBeDisabled()
      expect(monthlyPending).toBeDisabled()
      expect(yearlyPending).toHaveTextContent('...')
    })

    resolveCheckout(
      jsonResponse({ url: 'https://checkout.stripe.com/pay/yearly' })
    )
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/pay/yearly'
      )
    )
  })

  it('uses Customer Portal instead of checkout buttons for recovery states in PaywallBanner', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: user({ subscription_status: 'unpaid' }),
    })
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ url: 'https://billing.stripe.com/session/paywall' })
    )

    render(<PaywallBanner />)

    expect(screen.getByText('pastDueTitle')).toBeDefined()
    expect(screen.getByText('pastDueDesc')).toBeDefined()
    expect(screen.getByText('updatePayment')).toBeDefined()
    expect(screen.queryByText('planMonthly')).toBeNull()
    expect(screen.queryByText('paywallNoCharge')).toBeNull()
    expect(screen.queryByText('paywallNoChargeTrialUsed')).toBeNull()

    fireEvent.click(screen.getByText('updatePayment'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST',
      })
    )
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/paywall'
    )
  })

  it.each(['monthly', 'yearly'] as const)(
    'reports a failed %s paywall checkout and enables both actions',
    async (plan) => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}, 503))
      render(<PaywallBanner feature="reading" compact />)
      expect(screen.getByText('paywallReadingTitle')).toBeInTheDocument()
      fireEvent.click(
        screen.getByRole('button', {
          name: plan === 'monthly' ? 'planMonthly' : 'planYearly',
        })
      )
      expect(await screen.findByText('checkoutError')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'planMonthly' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'planYearly' })).toBeEnabled()
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/billing/checkout',
        expect.objectContaining({ body: JSON.stringify({ plan }) })
      )
    }
  )

  it('reports portal failures without losing payment recovery controls', async () => {
    useAuthStore.setState({ user: user({ subscription_status: 'past_due' }) })
    mockApiFetch.mockRejectedValueOnce(new Error('offline'))
    render(<PaywallBanner />)
    fireEvent.click(screen.getByRole('button', { name: 'updatePayment' }))
    expect(await screen.findByText('portalError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'updatePayment' })).toBeEnabled()
  })

  it('renders used-trial copy and hides paywalls for active subscribers', () => {
    useAuthStore.setState({
      user: user({ trial_used: true, subscription_status: 'none' }),
    })
    const view = render(<PaywallBanner feature="voice" />)
    expect(screen.getByText('paywallConversationTitle')).toBeInTheDocument()
    expect(screen.getByText('paywallNoChargeTrialUsed')).toBeInTheDocument()
    useAuthStore.setState({ user: user({ subscription_status: 'active' }) })
    view.rerender(<PaywallBanner feature="voice" />)
    expect(view.container).toBeEmptyDOMElement()
  })

  it('reports a non-success portal response', async () => {
    useAuthStore.setState({ user: user({ subscription_status: 'past_due' }) })
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}, 503))
    render(<PaywallBanner />)
    fireEvent.click(screen.getByRole('button', { name: 'updatePayment' }))
    expect(await screen.findByText('portalError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'updatePayment' })).toBeEnabled()
  })

  it.each([true, false])(
    'starts Checkout directly with a session and registration=%s',
    async (allowRegistration) => {
      mockLandingSubscriptionState.mockResolvedValueOnce({
        subscribed: false,
        trialUsed: false,
      })
      mockApiFetch.mockResolvedValueOnce(
        jsonResponse({ url: 'https://checkout.stripe.com/pay/monthly' })
      )

      render(
        <PricingSection
          allowRegistration={allowRegistration}
          stripeEnabled={true}
          trialDays={7}
          hasSession={true}
          priceMonthly={9.99}
          priceYearly={99.99}
          totalPriceMonthly={119.88}
          totalPriceYearly={99.99}
        />
      )

      await waitFor(() =>
        expect(screen.getAllByText('ctaRegister')).toHaveLength(3)
      )
      fireEvent.click(screen.getAllByText('ctaRegister')[0]!)

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenCalledWith('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'monthly' }),
        })
      )
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://checkout.stripe.com/pay/monthly'
      )
    }
  )

  it.each([true, false])(
    'routes public pricing links according to registration=%s',
    (allowRegistration) => {
      render(
        <PricingSection
          allowRegistration={allowRegistration}
          stripeEnabled
          trialDays={7}
          hasSession={false}
          priceMonthly={10}
          priceYearly={100}
          totalPriceMonthly={120}
          totalPriceYearly={120}
        />
      )
      const links = screen.getAllByRole('link')
      if (allowRegistration) {
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
          '/register',
          '/register?plan=monthly',
          '/register?plan=yearly',
          '/register?plan=yearly',
        ])
      } else {
        expect(
          links.every((link) => link.getAttribute('href') === '/login')
        ).toBe(true)
      }
    }
  )

  it('hides pricing after the subscription check confirms an active subscriber', async () => {
    mockLandingSubscriptionState.mockResolvedValueOnce({
      subscribed: true,
      trialUsed: false,
    })
    const { container } = render(
      <PricingSection
        allowRegistration
        stripeEnabled
        trialDays={7}
        hasSession
        priceMonthly={10}
        priceYearly={100}
        totalPriceMonthly={120}
        totalPriceYearly={120}
      />
    )
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it.each([true, false])(
    'restores checkout after a missing access token (refresh=%s)',
    async (success) => {
      useAuthStore.setState({ accessToken: null })
      mockRefresh.mockResolvedValueOnce(success ? 'new-token' : null)
      mockLandingSubscriptionState.mockResolvedValueOnce({
        subscribed: false,
        trialUsed: false,
      })
      mockApiFetch.mockResolvedValueOnce(new Response(null, { status: 503 }))
      render(
        <PricingSection
          allowRegistration
          stripeEnabled
          trialDays={7}
          hasSession
          priceMonthly={10}
          priceYearly={100}
          totalPriceMonthly={120}
          totalPriceYearly={120}
        />
      )
      const buttons = await screen.findAllByRole('button', {
        name: 'ctaRegister',
      })
      fireEvent.click(buttons[0]!)
      expect(await screen.findByText('checkoutError')).toBeInTheDocument()
      expect(mockRefresh).toHaveBeenCalledOnce()
      expect(
        mockApiFetch.mock.calls.some(([url]) => url === '/api/billing/checkout')
      ).toBe(success)
      expect(buttons[0]).toBeEnabled()
    }
  )

  it.each(['monthly', 'yearly'] as const)(
    'restores %s checkout buttons after an error for a used trial',
    async (plan) => {
      mockLandingSubscriptionState.mockResolvedValueOnce({
        subscribed: false,
        trialUsed: true,
      })
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}, 503))
      render(
        <PricingSection
          allowRegistration
          stripeEnabled
          trialDays={7}
          hasSession
          priceMonthly={10}
          priceYearly={100}
          totalPriceMonthly={120}
          totalPriceYearly={120}
        />
      )
      const buttons = await screen.findAllByRole('button', {
        name: 'ctaRegisterTrialUsed',
      })
      expect(buttons).toHaveLength(3)
      expect(screen.getByText('pricingDescTrialUsed')).toBeInTheDocument()
      fireEvent.click(buttons[plan === 'monthly' ? 0 : 1]!)
      expect(await screen.findByText('checkoutError')).toBeInTheDocument()
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/billing/checkout',
        expect.objectContaining({ body: JSON.stringify({ plan }) })
      )
      expect(
        screen
          .getAllByRole('button', { name: 'ctaRegisterTrialUsed' })
          .every((button) => !button.hasAttribute('disabled'))
      ).toBe(true)
    }
  )
})
