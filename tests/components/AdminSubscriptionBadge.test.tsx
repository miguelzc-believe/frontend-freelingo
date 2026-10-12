import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  AdminSubscriptionBadge,
  getSubscriptionLabel,
} from '@/components/admin/AdminSubscriptionBadge'

const statuses = [
  ['active', 'statusActive', 'border-green-500/40 text-green-400'],
  ['trialing', 'statusTrialing', 'border-blue-500/40 text-blue-400'],
  ['past_due', 'statusPastDue', 'border-yellow-500/40 text-yellow-400'],
  ['unpaid', 'statusUnpaid', 'border-yellow-500/40 text-yellow-400'],
  ['paused', 'statusPaused', 'border-yellow-500/40 text-yellow-400'],
  ['incomplete', 'statusIncomplete', 'border-orange-500/40 text-orange-400'],
  [
    'incomplete_expired',
    'statusIncompleteExpired',
    'border-orange-500/40 text-orange-400',
  ],
  ['canceled', 'statusCanceled', 'border-fl-border text-fl-muted-2'],
  ['none', 'statusNone', 'border-fl-border text-fl-muted-3'],
  ['unknown', 'statusNone', 'border-fl-border text-fl-muted-3'],
  ['__proto__', 'statusNone', 'border-fl-border text-fl-muted-3'],
] as const

const baseClass =
  'text-fl-hint border px-2 py-0.5 font-mono tracking-widest uppercase'

describe('AdminSubscriptionBadge', () => {
  it.each(statuses)(
    'preserves the label and classes for %s',
    (status, label, toneClass) => {
      const translate = vi.fn((key: string) => `billing.${key}`)

      render(<AdminSubscriptionBadge status={status} tBilling={translate} />)

      const badge = screen.getByText(`billing.${label}`)
      expect(badge.tagName).toBe('SPAN')
      expect(badge.className).toBe(`${baseClass} ${toneClass}`)
      expect(translate).toHaveBeenCalledWith(label)
      expect(getSubscriptionLabel(status, translate)).toBe(`billing.${label}`)
    }
  )

  it('adds only the inline-flex class for the mobile list badge', () => {
    const translate = (key: string) => key
    const { rerender } = render(
      <AdminSubscriptionBadge status="active" tBilling={translate} inline />
    )

    expect(screen.getByText('statusActive').className).toBe(
      'text-fl-hint inline-flex border px-2 py-0.5 font-mono tracking-widest uppercase border-green-500/40 text-green-400'
    )

    rerender(<AdminSubscriptionBadge status="canceled" tBilling={translate} />)
    expect(screen.queryByText('statusActive')).toBeNull()
    expect(screen.getByText('statusCanceled').className).toBe(
      `${baseClass} border-fl-border text-fl-muted-2`
    )
  })
})
