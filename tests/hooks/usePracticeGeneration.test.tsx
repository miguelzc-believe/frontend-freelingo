import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePracticeGeneration } from '@/hooks/usePracticeGeneration'

function advanceTime(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds))
}

describe('usePracticeGeneration lifecycle equivalence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with no warning or timer outside generation', () => {
    const { result, rerender } = renderHook(
      ({ isGenerating }) => usePracticeGeneration(isGenerating),
      { initialProps: { isGenerating: false } }
    )
    expect(result.current.generatingWarn).toBe(false)
    expect(result.current.generateAbortRef.current).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    advanceTime(30_000)
    rerender({ isGenerating: false })
    expect(result.current.generatingWarn).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('warns at exactly 15 seconds without restarting on unrelated renders', () => {
    const { result, rerender } = renderHook(
      ({ isGenerating }) => usePracticeGeneration(isGenerating),
      { initialProps: { isGenerating: true } }
    )
    expect(result.current.generatingWarn).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    advanceTime(10_000)
    rerender({ isGenerating: true })
    expect(vi.getTimerCount()).toBe(1)
    advanceTime(4_999)
    expect(result.current.generatingWarn).toBe(false)
    advanceTime(1)
    expect(result.current.generatingWarn).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    advanceTime(15_000)
    expect(result.current.generatingWarn).toBe(true)
  })

  it('clears the pending timer on leaving generation and gives retries a fresh 15 seconds', () => {
    const { result, rerender } = renderHook(
      ({ isGenerating }) => usePracticeGeneration(isGenerating),
      { initialProps: { isGenerating: true } }
    )
    advanceTime(14_000)
    rerender({ isGenerating: false })
    expect(vi.getTimerCount()).toBe(0)
    advanceTime(2_000)
    expect(result.current.generatingWarn).toBe(false)
    rerender({ isGenerating: true })
    expect(vi.getTimerCount()).toBe(1)
    advanceTime(14_999)
    expect(result.current.generatingWarn).toBe(false)
    advanceTime(1)
    expect(result.current.generatingWarn).toBe(true)
  })

  it('resets a displayed warning when generation finishes and on a later retry', () => {
    const { result, rerender } = renderHook(
      ({ isGenerating }) => usePracticeGeneration(isGenerating),
      { initialProps: { isGenerating: true } }
    )
    advanceTime(15_000)
    expect(result.current.generatingWarn).toBe(true)
    rerender({ isGenerating: false })
    expect(result.current.generatingWarn).toBe(false)
    rerender({ isGenerating: true })
    expect(result.current.generatingWarn).toBe(false)
    advanceTime(14_999)
    expect(result.current.generatingWarn).toBe(false)
  })

  it('clears the warning timer and aborts the screen-owned current request on unmount', () => {
    const controller = new AbortController()
    const abort = vi.spyOn(controller, 'abort')
    const { result, unmount } = renderHook(() => usePracticeGeneration(true))
    result.current.generateAbortRef.current = controller
    advanceTime(14_999)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(abort).toHaveBeenCalledExactlyOnceWith()
    expect(controller.signal.aborted).toBe(true)
    advanceTime(30_000)
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('does not abort or replace the request on generation-state transitions', () => {
    const controller = new AbortController()
    const { result, rerender, unmount } = renderHook(
      ({ isGenerating }) => usePracticeGeneration(isGenerating),
      { initialProps: { isGenerating: true } }
    )
    const abortRef = result.current.generateAbortRef
    abortRef.current = controller
    rerender({ isGenerating: false })
    expect(result.current.generateAbortRef).toBe(abortRef)
    expect(result.current.generateAbortRef.current).toBe(controller)
    expect(controller.signal.aborted).toBe(false)
    rerender({ isGenerating: true })
    expect(controller.signal.aborted).toBe(false)
    unmount()
    expect(controller.signal.aborted).toBe(true)
  })

  it('honors the screen clearing a completed request before unmount', () => {
    const controller = new AbortController()
    const { result, unmount } = renderHook(() => usePracticeGeneration(true))
    result.current.generateAbortRef.current = controller
    result.current.generateAbortRef.current = null
    expect(() => unmount()).not.toThrow()
    expect(controller.signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('only aborts the latest ref value, without adding request-race handling', () => {
    const earlier = new AbortController()
    const current = new AbortController()
    const { result, unmount } = renderHook(() => usePracticeGeneration(true))
    result.current.generateAbortRef.current = earlier
    result.current.generateAbortRef.current = current
    unmount()
    expect(earlier.signal.aborted).toBe(false)
    expect(current.signal.aborted).toBe(true)
  })

  it('keeps each mounted practice screen timer and abort ref isolated', () => {
    const reading = renderHook(() => usePracticeGeneration(true))
    advanceTime(5_000)
    const listening = renderHook(() => usePracticeGeneration(true))
    const readingController = new AbortController()
    const listeningController = new AbortController()
    reading.result.current.generateAbortRef.current = readingController
    listening.result.current.generateAbortRef.current = listeningController
    advanceTime(10_000)
    expect(reading.result.current.generatingWarn).toBe(true)
    expect(listening.result.current.generatingWarn).toBe(false)
    reading.unmount()
    expect(readingController.signal.aborted).toBe(true)
    expect(listeningController.signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    advanceTime(5_000)
    expect(listening.result.current.generatingWarn).toBe(true)
    listening.unmount()
    expect(listeningController.signal.aborted).toBe(true)
  })

  it('retains one timer through StrictMode effect replay and clears it on unmount', () => {
    const { result, unmount } = renderHook(() => usePracticeGeneration(true), {
      wrapper: StrictMode,
    })
    expect(vi.getTimerCount()).toBe(1)
    advanceTime(15_000)
    expect(result.current.generatingWarn).toBe(true)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
