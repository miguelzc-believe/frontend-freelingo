import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VoiceQuota } from '@/components/conversation/VoiceSessionExtras'
import type { QuotaStatus } from '@/types/api'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

const quota: QuotaStatus = {
  sessions_this_week: 3,
  sessions_limit: 5,
  sessions_unlimited: false,
  minutes_today: 0,
  minutes_limit: 30,
  time_unlimited: false,
  minutes_this_week: 0,
  weekly_minutes_limit: 100,
  weekly_minutes_unlimited: false,
  tokens_unlimited: true,
}

describe('voice quota presentation', () => {
  it.each([0, 2])(
    'prioritizes freemium remaining %s over server quota',
    (remaining) => {
      render(<VoiceQuota remaining={remaining} limit={10} quota={quota} />)
      expect(screen.getByText('freemiumVoiceRemaining')).toHaveClass(
        remaining === 0 ? 'text-red-500' : 'text-fl-muted-2'
      )
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it('keeps zero limit valid even in trial mode', () => {
    render(<VoiceQuota remaining={0} limit={0} quota={quota} trialMode />)
    expect(screen.getByText('freemiumVoiceRemaining')).toBeInTheDocument()
  })

  it.each([
    { remaining: undefined, limit: 10 },
    { remaining: 0, limit: undefined },
    { remaining: undefined, limit: undefined },
  ])(
    'falls back to quota when freemium values are incomplete: %j',
    (values) => {
      render(<VoiceQuota {...values} quota={quota} />)
      expect(
        screen.getByRole('button', { name: /3\/5 ses/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByText('freemiumVoiceRemaining')
      ).not.toBeInTheDocument()
    }
  )

  it('hides general quota in trial mode', () => {
    const { container } = render(<VoiceQuota quota={quota} trialMode />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without either quota source', () => {
    const { container } = render(<VoiceQuota quota={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
