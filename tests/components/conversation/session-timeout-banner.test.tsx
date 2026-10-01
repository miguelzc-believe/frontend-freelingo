import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

// Renders `key{values}` so the countdown value is observable.
const stableT = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key

vi.mock('use-intl', () => ({
  useTranslations: () => stableT,
}))

import SessionTimeoutBanner from '@/components/conversation/SessionTimeoutBanner'

function remaining() {
  const text = screen.getByText(/^warningTimeout:/)?.textContent ?? ''
  return JSON.parse(text.replace('warningTimeout:', '')) as { seconds: number }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SessionTimeoutBanner', () => {
  it('counts the remaining seconds down once per second', () => {
    render(<SessionTimeoutBanner seconds={30} />)
    expect(remaining()).toEqual({ seconds: 30 })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(remaining()).toEqual({ seconds: 27 })
  })

  it('stops counting at zero and never goes negative', () => {
    render(<SessionTimeoutBanner seconds={2} />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(remaining()).toEqual({ seconds: 0 })
  })

  it('resets the countdown when the backend reports a new value', () => {
    const { rerender } = render(<SessionTimeoutBanner seconds={10} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(remaining()).toEqual({ seconds: 8 })
    rerender(<SessionTimeoutBanner seconds={45} />)
    expect(remaining()).toEqual({ seconds: 45 })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(remaining()).toEqual({ seconds: 44 })
  })

  it('does not start an interval for an already expired session', () => {
    render(<SessionTimeoutBanner seconds={0} />)
    expect(remaining()).toEqual({ seconds: 0 })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(remaining()).toEqual({ seconds: 0 })
  })
})
