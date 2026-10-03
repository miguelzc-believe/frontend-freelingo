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
})
