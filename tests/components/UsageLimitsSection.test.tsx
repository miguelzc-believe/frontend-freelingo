import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UsageLimitsSection } from '@/components/settings/UsageLimitsSection'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('UsageLimitsSection', () => {
  it('preserves zero counts and the rounded token formatter', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({
        sessions_this_week: 0,
        sessions_limit: 0,
        sessions_unlimited: false,
        minutes_today: 0,
        minutes_limit: 30,
        time_unlimited: false,
        minutes_this_week: 0,
        weekly_minutes_limit: 90,
        weekly_minutes_unlimited: false,
        tokens_this_month: 1499,
        tokens_monthly_limit: 10500,
        tokens_unlimited: false,
      }),
    })
    render(<UsageLimitsSection />)
    await screen.findByText('quotaHint')
    expect(screen.getByText('0 / 0')).toBeInTheDocument()
    expect(screen.getByText('0 / 30')).toBeInTheDocument()
    expect(screen.getByText('0 / 90')).toBeInTheDocument()
    expect(screen.getByText('1k / 11k')).toBeInTheDocument()
  })

  it('renders unlimited, exceeded and unavailable token quotas', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({
        sessions_this_week: 5,
        sessions_limit: 3,
        sessions_unlimited: false,
        minutes_today: 5,
        minutes_limit: 20,
        time_unlimited: true,
        minutes_this_week: 20,
        weekly_minutes_limit: 20,
        weekly_minutes_unlimited: false,
      }),
    })
    render(<UsageLimitsSection title="Usage" />)
    await screen.findByText('quotaHint')
    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(screen.getByText('quotaUnlimited')).toBeInTheDocument()
    expect(screen.getByText('5 / 3')).toHaveClass('text-fl-error')
    expect(screen.getByText('20 / 20')).toHaveClass('text-fl-error')
    expect(screen.getByText('0k / 0k')).toBeInTheDocument()
  })

  it('keeps the loading skeleton if the quota request fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('offline'))
    const { container } = render(<UsageLimitsSection />)
    await vi.waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/quota')
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('quotaHint')).not.toBeInTheDocument()
  })
})
