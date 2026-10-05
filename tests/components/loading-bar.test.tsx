import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loadingState } = vi.hoisted(() => ({
  loadingState: { count: 0, complete: false, finishComplete: vi.fn() },
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/store/loading', () => ({
  useLoadingStore: (selector: (state: typeof loadingState) => unknown) =>
    selector(loadingState),
}))

import { LoadingBar } from '@/components/ui/loading-bar'

describe('LoadingBar', () => {
  beforeEach(() => {
    loadingState.count = 0
    loadingState.complete = false
    loadingState.finishComplete.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays hidden until a request starts', () => {
    const { rerender } = render(<LoadingBar />)
    expect(screen.queryByRole('progressbar')).toBeNull()

    loadingState.count = 1
    rerender(<LoadingBar />)
    expect(
      screen.getByRole('progressbar', { name: 'loading' })
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar').tagName).toBe('PROGRESS')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
  })

  it('keeps a bar visible for the minimum duration before completing', () => {
    const { rerender } = render(<LoadingBar />)
    loadingState.count = 1
    rerender(<LoadingBar />)
    expect(
      screen.getByRole('progressbar', { name: 'loading' })
    ).toBeInTheDocument()

    loadingState.count = 0
    loadingState.complete = true
    rerender(<LoadingBar />)
    act(() => vi.advanceTimersByTime(599))
    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveClass('animate-loading-bar-complete')
    expect(loadingState.finishComplete).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(399))
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(loadingState.finishComplete).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(loadingState.finishComplete).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(loadingState.finishComplete).toHaveBeenCalledTimes(1)
  })

  it('cancels the completion timer when another request starts', () => {
    const { rerender } = render(<LoadingBar />)
    loadingState.count = 1
    rerender(<LoadingBar />)
    loadingState.count = 0
    loadingState.complete = true
    rerender(<LoadingBar />)
    act(() => vi.advanceTimersByTime(300))

    loadingState.count = 1
    loadingState.complete = false
    rerender(<LoadingBar />)
    act(() => vi.advanceTimersByTime(1000))

    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveClass('animate-loading-bar')
    expect(progress).not.toHaveClass('animate-loading-bar-complete')
    expect(loadingState.finishComplete).not.toHaveBeenCalled()
  })

  it('cancels the completing phase when a new request starts', () => {
    const { rerender } = render(<LoadingBar />)
    loadingState.count = 1
    rerender(<LoadingBar />)
    loadingState.count = 0
    loadingState.complete = true
    rerender(<LoadingBar />)
    act(() => vi.advanceTimersByTime(600))
    expect(screen.getByRole('progressbar')).toHaveClass(
      'animate-loading-bar-complete'
    )
    loadingState.count = 1
    loadingState.complete = false
    rerender(<LoadingBar />)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('progressbar')).toHaveClass('animate-loading-bar')
    expect(loadingState.finishComplete).not.toHaveBeenCalled()
  })

  it('does not schedule a completion animation if no request was shown', () => {
    loadingState.complete = true
    render(<LoadingBar />)
    act(() => vi.runAllTimers())
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(loadingState.finishComplete).not.toHaveBeenCalled()
  })
})
