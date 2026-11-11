import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionPlanButtons } from '@/components/billing/SubscriptionPlanButtons'
import { deferred } from '../helpers/voice-capture'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))
vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    key === 'planYearly' ? 'Yearly · save' : key,
}))

describe('subscription plan buttons', () => {
  beforeEach(() => api.mockReset())

  it.each(['yearly', 'monthly'] as const)(
    'disables both plans during %s checkout and recovers from errors',
    async (plan) => {
      const pending = deferred<Response>()
      api.mockReturnValueOnce(pending.promise)
      render(<SubscriptionPlanButtons />)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[plan === 'yearly' ? 0 : 1]!)
      for (const button of buttons) expect(button).toBeDisabled()
      expect(buttons[plan === 'yearly' ? 0 : 1]).toHaveTextContent('...')
      expect(api).toHaveBeenCalledWith('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      pending.resolve(new Response(null, { status: 503 }))
      expect(await screen.findByText('checkoutError')).toBeInTheDocument()
      for (const button of buttons) expect(button).toBeEnabled()
    }
  )

  it('reports a network failure without leaving the plans disabled', async () => {
    api.mockRejectedValueOnce(new Error('offline'))
    render(<SubscriptionPlanButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'planMonthly' }))
    expect(await screen.findByText('checkoutError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'planMonthly' })).toBeEnabled()
  })

  it('navigates to the checkout URL returned for a monthly subscription', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign },
    })
    try {
      api.mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://example.test/checkout' }))
      )
      render(<SubscriptionPlanButtons />)
      fireEvent.click(screen.getByRole('button', { name: 'planMonthly' }))
      await vi.waitFor(() =>
        expect(assign).toHaveBeenCalledWith('https://example.test/checkout')
      )
      expect(api).toHaveBeenCalledWith(
        '/api/billing/checkout',
        expect.objectContaining({ body: JSON.stringify({ plan: 'monthly' }) })
      )
    } finally {
      if (original) Object.defineProperty(window, 'location', original)
    }
  })
})
