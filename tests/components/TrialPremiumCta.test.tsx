import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrialPremiumCta } from '@/components/conversation/VoiceSessionExtras'
import { useConfigStore } from '@/store/config'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  push: vi.fn(),
  yearlyLabel: 'Yearly plan · Save 20%',
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en-GB',
  useTranslations: () => (key: string) =>
    key === 'planYearly' ? mocks.yearlyLabel : key,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))

const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'location'
)

beforeEach(() => {
  mocks.apiFetch.mockReset()
  mocks.push.mockReset()
  mocks.yearlyLabel = 'Yearly plan · Save 20%'
  useConfigStore.setState({ priceMonthly: 9.99, priceYearly: 99.99 })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: vi.fn() },
  })
})

afterEach(() => {
  cleanup()
  if (originalLocationDescriptor) {
    Object.defineProperty(window, 'location', originalLocationDescriptor)
  }
})

describe('trial premium checkout CTA', () => {
  it('shows annual savings and submits the annual checkout plan', async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.example/annual' }),
    })
    render(<TrialPremiumCta />)

    expect(screen.getByText('Yearly plan →')).toBeInTheDocument()
    expect(screen.getByText('Save 20%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yearly plan/ }))

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://billing.example/annual'
      )
    )
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/billing/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ plan: 'yearly' }),
      })
    )
  })

  it('supports an annual label without savings and submits monthly checkout', async () => {
    mocks.yearlyLabel = 'Yearly plan'
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.example/monthly' }),
    })
    render(<TrialPremiumCta />)

    expect(screen.getByText('Yearly plan')).toBeInTheDocument()
    expect(screen.queryByText('Save 20%')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /planMonthly/ }))

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://billing.example/monthly'
      )
    )
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/billing/checkout',
      expect.objectContaining({
        body: JSON.stringify({ plan: 'monthly' }),
      })
    )
  })

  it.each([
    ['http', { ok: false, json: async () => ({}) }],
    ['network', new TypeError('offline')],
  ])(
    'shows localized error for %s checkout failure',
    async (_case, failure) => {
      mocks.apiFetch.mockRejectedValueOnce(failure)
      render(<TrialPremiumCta />)
      fireEvent.click(screen.getByRole('button', { name: /planMonthly/ }))

      expect(await screen.findByText('checkoutError')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /planMonthly/ })).toBeEnabled()
    }
  )

  it('offers the paywall skip route', () => {
    render(<TrialPremiumCta />)
    fireEvent.click(screen.getByRole('button', { name: 'paywallSkip' }))
    expect(mocks.push).toHaveBeenCalledWith('/plan')
  })
})
