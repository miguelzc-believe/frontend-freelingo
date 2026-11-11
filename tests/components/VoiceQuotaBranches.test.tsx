import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  QuotaPill,
  VoiceQuota,
} from '@/components/conversation/VoiceSessionExtras'
import type { QuotaStatus } from '@/types/api'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

const base: QuotaStatus = {
  sessions_this_week: 1,
  sessions_limit: 5,
  sessions_unlimited: false,
  minutes_today: 2,
  minutes_limit: 30,
  time_unlimited: false,
  minutes_this_week: 2,
  weekly_minutes_limit: 100,
  weekly_minutes_unlimited: false,
  tokens_unlimited: true,
}

describe('voice quota branch coverage', () => {
  it('renders each limited quota and expands its detail rows', () => {
    const quota = {
      ...base,
      sessions_this_week: 5,
      minutes_today: 30,
      tokens_unlimited: false,
      tokens_this_month: 2500,
      tokens_monthly_limit: 5000,
    }
    render(<QuotaPill quota={quota} />)

    const toggle = screen.getByRole('button', {
      name: /5\/5 ses.*30\/30 min.*3k\/5k tok/,
    })
    expect(toggle).toHaveClass('border-fl-error/50')
    fireEvent.click(toggle)

    expect(screen.getByText('quotaSessions')).toBeInTheDocument()
    expect(screen.getByText('quotaMinutes')).toBeInTheDocument()
    expect(screen.getByText('quotaTokens')).toBeInTheDocument()
    expect(
      screen
        .getByText('quotaSessions')
        .parentElement?.querySelector('.tabular-nums')
    ).toHaveClass('text-fl-error')
  })

  it('does not mark quotas exceeded when usage is below each limit', () => {
    const quota = {
      ...base,
      tokens_unlimited: false,
      tokens_this_month: 100,
      tokens_monthly_limit: 1000,
    }
    render(<QuotaPill quota={quota} />)
    expect(screen.getByRole('button')).toHaveClass('border-fl-border')
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen
        .getByText('quotaSessions')
        .parentElement?.querySelector('.tabular-nums')
    ).toHaveClass('text-fl-muted-2')
  })

  it('omits unlimited session, time and token details and displays infinity', () => {
    const quota = {
      ...base,
      sessions_unlimited: true,
      time_unlimited: true,
      tokens_unlimited: true,
    }
    render(<QuotaPill quota={quota} />)
    expect(screen.getByRole('button')).toHaveTextContent('∞')
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen.getByText('quotaSessions').nextElementSibling
    ).toHaveTextContent('∞')
    expect(
      screen.getByText('quotaMinutes').nextElementSibling
    ).toHaveTextContent('∞')
    expect(screen.queryByText('quotaTokens')).not.toBeInTheDocument()
  })

  it('handles absent token usage and limit as zero', () => {
    const quota = { ...base, tokens_unlimited: false }
    render(<QuotaPill quota={quota} />)
    expect(screen.getByRole('button')).toHaveTextContent('0k/0k tok')
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen
        .getByText('quotaTokens')
        .parentElement?.querySelector('.tabular-nums')
    ).toHaveTextContent('0')
  })

  it('avoids dividing by zero and caps the visual bar when usage exceeds the limit', () => {
    const quota = {
      ...base,
      sessions_this_week: 0,
      sessions_limit: 0,
      minutes_today: 45,
      minutes_limit: 30,
    }
    render(<QuotaPill quota={quota} />)
    fireEvent.click(screen.getByRole('button'))

    const bars = screen
      .getAllByText(/quotaSessions|quotaMinutes/)
      .map((label) => label.parentElement?.querySelector('.h-full'))
    expect(bars[0]).not.toHaveStyle({ width: 'NaN%' })
    expect(bars[1]).toHaveStyle({ width: '100%' })
    expect(bars[1]).toHaveClass('bg-fl-error')
  })

  it('marks token quota exceeded at its limit', () => {
    const quota = {
      ...base,
      tokens_unlimited: false,
      tokens_this_month: 900,
      tokens_monthly_limit: 900,
    }
    render(<QuotaPill quota={quota} />)
    expect(screen.getByRole('button')).toHaveClass('border-fl-error/50')
  })

  it('keeps remaining quota neutral above zero and red at zero or below', () => {
    const { rerender } = render(
      <VoiceQuota remaining={1} limit={10} quota={null} />
    )
    expect(screen.getByText('freemiumVoiceRemaining')).toHaveClass(
      'text-fl-muted-2'
    )
    rerender(<VoiceQuota remaining={-1} limit={10} quota={null} />)
    expect(screen.getByText('freemiumVoiceRemaining')).toHaveClass(
      'text-red-500'
    )
  })
})
