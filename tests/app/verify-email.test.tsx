import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VerifyEmailPage from '@/app/(auth)/verify-email/page'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  token: 'valid',
}))

vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))
vi.mock('@/lib/navigation', () => ({
  useSearchParams: () => {
    const params = new URLSearchParams()
    if (mocks.token) params.set('token', mocks.token)
    return params
  },
}))

async function renderPage() {
  await act(async () => {
    render(<VerifyEmailPage />)
  })
}

function expectError() {
  expect(screen.getByText('auth.verifyEmail.error')).toBeVisible()
  expect(screen.getByRole('button', { name: 'common.retry' })).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'auth.verifyEmail.goToLogin' })
  ).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText('auth.verifyEmail.success')).not.toBeInTheDocument()
}

function mockAbortableRequest() {
  mocks.apiFetch.mockImplementation(
    (_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        )
      })
  )
}

function requestSignal(): AbortSignal {
  const call = mocks.apiFetch.mock.calls[0]
  if (!call) throw new Error('Expected a verification request')
  return call[1].signal as AbortSignal
}

describe('verify email request equivalence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.apiFetch.mockReset()
    mocks.token = 'valid'
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('encodes the token and shows success with a login link', async () => {
    mocks.token = 'a+b/c?d=e&f ü'
    mocks.apiFetch.mockResolvedValue(new Response(null, { status: 200 }))

    await renderPage()

    expect(mocks.apiFetch).toHaveBeenCalledExactlyOnceWith(
      `/api/auth/verify-email?token=${encodeURIComponent(mocks.token)}`,
      { signal: expect.any(AbortSignal) }
    )
    expect(screen.getByText('auth.verifyEmail.success')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'auth.verifyEmail.goToLogin' })
    ).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    [
      'non-OK response',
      () => Promise.resolve(new Response(null, { status: 400 })),
    ],
    ['generic rejection', () => Promise.reject(new Error('Transport failed'))],
    [
      'AbortError rejection',
      () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    ],
  ])('shows the same error UI for %s', async (_label, response) => {
    mocks.apiFetch.mockImplementation(response)

    await renderPage()

    expectError()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not request verification without a token, including retry', async () => {
    mocks.token = ''

    await renderPage()
    expectError()
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))

    expectError()
    expect(mocks.apiFetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps loading until the 15-second timeout aborts and settles the request', async () => {
    mockAbortableRequest()
    await renderPage()
    const signal = requestSignal()

    expect(screen.getByRole('status')).toHaveAccessibleName('common.loading')
    await act(async () => {
      vi.advanceTimersByTime(14_999)
    })
    expect(signal.aborted).toBe(false)
    expect(screen.getByRole('status')).toBeVisible()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(signal.aborted).toBe(true)
    expectError()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts a pending request on unmount and clears its timeout after settlement', async () => {
    mockAbortableRequest()
    const view = render(<VerifyEmailPage />)
    const signal = requestSignal()
    expect(signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      view.unmount()
    })

    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
