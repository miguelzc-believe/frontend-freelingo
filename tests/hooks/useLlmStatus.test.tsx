import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmStatus } from '@/lib/llm-settings'

const mocks = vi.hoisted(() => ({ fetchLlmStatus: vi.fn() }))
vi.mock('@/lib/llm-settings', () => mocks)
import { useLlmStatus } from '@/hooks/useLlmStatus'

const empty: LlmStatus = { configured: false, provider: null, model: null }
const configured: LlmStatus = {
  configured: true,
  provider: 'ollama',
  model: 'test-model',
}

describe('authenticated LLM status lifecycle', () => {
  beforeEach(() => mocks.fetchLlmStatus.mockReset())

  it('does not fetch until authenticated/enabled and hides status when disabled', async () => {
    mocks.fetchLlmStatus.mockResolvedValue(empty)
    const { result, rerender } = renderHook(
      ({ enabled }) => useLlmStatus(enabled),
      { initialProps: { enabled: false } }
    )
    expect(mocks.fetchLlmStatus).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.status).toEqual(empty))
    rerender({ enabled: false })
    expect(result.current.status).toBeNull()
    act(() => window.dispatchEvent(new Event('focus')))
    expect(mocks.fetchLlmStatus).toHaveBeenCalledOnce()
  })

  it('refreshes on successful save events and window focus without shared state', async () => {
    mocks.fetchLlmStatus.mockResolvedValue(empty)
    const { result } = renderHook(() => useLlmStatus(true))
    await waitFor(() => expect(result.current.status).toEqual(empty))
    mocks.fetchLlmStatus.mockResolvedValue(configured)
    act(() => window.dispatchEvent(new Event('freelingo:llm-settings-saved')))
    await waitFor(() => expect(result.current.status).toEqual(configured))
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(mocks.fetchLlmStatus).toHaveBeenCalledTimes(3))
  })

  it('does not let a stale pre-save response overwrite refreshed status', async () => {
    let resolveOld: (value: LlmStatus) => void = () => {
      throw new Error('not initialized')
    }
    mocks.fetchLlmStatus.mockImplementationOnce(
      () =>
        new Promise<LlmStatus>((resolve) => {
          resolveOld = resolve
        })
    )
    const { result } = renderHook(() => useLlmStatus(true))
    mocks.fetchLlmStatus.mockResolvedValue(configured)
    act(() => window.dispatchEvent(new Event('freelingo:llm-settings-saved')))
    await waitFor(() => expect(result.current.status).toEqual(configured))
    await act(async () => resolveOld(empty))
    expect(result.current.status).toEqual(configured)
  })

  it('retries errors and removes listeners on unmount', async () => {
    mocks.fetchLlmStatus.mockRejectedValueOnce(new Error('offline'))
    const { result, unmount } = renderHook(() => useLlmStatus(true))
    await waitFor(() => expect(result.current.error).toBe(true))
    mocks.fetchLlmStatus.mockResolvedValue(configured)
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toEqual(configured))
    expect(result.current.error).toBe(false)
    unmount()
    act(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('freelingo:llm-settings-saved'))
    })
    expect(mocks.fetchLlmStatus).toHaveBeenCalledTimes(2)
  })
})
