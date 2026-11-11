import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FreemiumQuotaBanner } from '@/components/billing/FreemiumQuotaBanner'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useFreemiumStore } from '@/store/freemium'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string, values?: { days: number }) =>
    values ? `${key} ${values.days}` : key,
}))

const freeUser = {
  id: 1,
  username: 'user',
  displayName: 'User',
  role: 'user' as const,
  conversation_max_duration: 900,
  conversation_inactivity_timeout: 300,
  subscription_status: 'none' as const,
}
const quota = {
  trial_active: false,
  trial_ends_at: null,
  chat_remaining: 5,
  chat_limit: 20,
  lessons_remaining: 0,
  lessons_limit: 0,
  listening_remaining: 3,
  listening_limit: 10,
  reading_remaining: 2,
  reading_limit: 8,
  voice_remaining_seconds: 61,
  voice_limit_seconds: 300,
}

describe('freemium quota banner', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: freeUser })
    useConfigStore.setState({ stripeEnabled: true })
    useFreemiumStore.setState({ status: quota })
  })

  it.each([
    ['chat', 'chatLabel', '5/20', true],
    ['listening', 'listeningLabel', '3/10', false],
    ['reading', 'readingLabel', '2/8', true],
    ['voice', 'voiceLabel', '2/5', false],
  ] as const)(
    'renders %s quota and low-limit warning',
    (feature, label, count, low) => {
      render(<FreemiumQuotaBanner feature={feature} />)
      expect(screen.getByText(label, { exact: false })).toHaveTextContent(count)
      expect(Boolean(screen.queryByText('freeLimit'))).toBe(low)
    }
  )

  it('shows a subscription requirement for a blocked feature', () => {
    render(<FreemiumQuotaBanner feature="lessons" />)
    expect(screen.getByText('lessonsLabel')).toBeInTheDocument()
    expect(screen.getByText('requiresSubscription')).toBeInTheDocument()
  })

  it('shows unlimited use during an active trial', () => {
    useAuthStore.setState({
      user: {
        ...freeUser,
        freemium_trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
    render(<FreemiumQuotaBanner feature="chat" />)
    expect(screen.getByText(/trialDaysLeft 1/)).toBeInTheDocument()
    expect(screen.getByText('trialUnlimited')).toBeInTheDocument()
  })

  it('hides when billing is disabled, subscription is active or status is missing', () => {
    useConfigStore.setState({ stripeEnabled: false })
    const { container, rerender } = render(
      <FreemiumQuotaBanner feature="chat" />
    )
    expect(container).toBeEmptyDOMElement()
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({
      user: { ...freeUser, subscription_status: 'active' },
    })
    rerender(<FreemiumQuotaBanner feature="chat" />)
    expect(container).toBeEmptyDOMElement()
    useAuthStore.setState({ user: freeUser })
    useFreemiumStore.setState({ status: null })
    rerender(<FreemiumQuotaBanner feature="chat" />)
    expect(container).toBeEmptyDOMElement()
  })
})
