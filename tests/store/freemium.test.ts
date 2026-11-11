import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchMock = vi.fn()

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

import { useFreemiumStore } from '@/store/freemium'

const status = {
  trial_active: false,
  trial_ends_at: null,
  chat_remaining: 3,
  chat_limit: 3,
  lessons_remaining: 2,
  lessons_limit: 3,
  listening_remaining: 2,
  listening_limit: 2,
  reading_remaining: 2,
  reading_limit: 2,
  voice_remaining_seconds: 900,
  voice_limit_seconds: 900,
}

describe('freemium store', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    useFreemiumStore.setState({ status: null, loaded: false, lastFetch: 0 })
  })

  it('uses the cached status during the cache window', async () => {
    useFreemiumStore.setState({ status, loaded: true, lastFetch: Date.now() })

    await useFreemiumStore.getState().fetchStatus()

    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('refreshes the status when forced', async () => {
    const refreshed = { ...status, lessons_remaining: 1 }
    useFreemiumStore.setState({ status, loaded: true, lastFetch: Date.now() })
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(refreshed),
    })

    await useFreemiumStore.getState().fetchStatus(true)

    expect(apiFetchMock).toHaveBeenCalledWith('/api/freemium/status')
    expect(useFreemiumStore.getState().status).toEqual(refreshed)
  })

  it('refreshes an expired cache without requiring a forced request', async () => {
    useFreemiumStore.setState({
      status,
      loaded: true,
      lastFetch: Date.now() - 60_001,
    })
    const refreshed = { ...status, chat_remaining: 1 }
    apiFetchMock.mockResolvedValue({ ok: true, json: async () => refreshed })
    await useFreemiumStore.getState().fetchStatus()
    expect(useFreemiumStore.getState().status).toEqual(refreshed)
  })

  it.each(['http', 'network'] as const)(
    'keeps the previous quota after a %s failure',
    async (failure) => {
      useFreemiumStore.setState({ status, loaded: true, lastFetch: 1 })
      if (failure === 'http') apiFetchMock.mockResolvedValueOnce({ ok: false })
      else apiFetchMock.mockRejectedValueOnce(new Error('offline'))
      await expect(
        useFreemiumStore.getState().fetchStatus()
      ).resolves.toBeUndefined()
      expect(useFreemiumStore.getState()).toMatchObject({
        status,
        loaded: true,
        lastFetch: 1,
      })
    }
  )

  it('does not decrement missing status or reduce a quota below zero', () => {
    useFreemiumStore.getState().decrement('chat_remaining')
    expect(useFreemiumStore.getState().status).toBeNull()
    useFreemiumStore.setState({ status: { ...status, chat_remaining: 1 } })
    useFreemiumStore.getState().decrement('chat_remaining')
    useFreemiumStore.getState().decrement('chat_remaining')
    expect(useFreemiumStore.getState().status?.chat_remaining).toBe(0)
    expect(useFreemiumStore.getState().status?.lessons_remaining).toBe(2)
  })
})
