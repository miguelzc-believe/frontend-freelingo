import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import { deferred } from '../helpers/voice-capture'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('forgot password', () => {
  beforeEach(() => api.mockReset())

  it('shows a pending state then confirmation with a login link', async () => {
    const pending = deferred<Response>()
    api.mockReturnValue(pending.promise)
    render(<ForgotPasswordPage />)
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))
    expect(screen.getByRole('button', { name: 'sending' })).toBeDisabled()
    expect(api).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'learner@example.com' }),
    })
    pending.resolve(new Response('{}'))
    expect(await screen.findByText('sent')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'backToLogin' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(
      screen.queryByPlaceholderText('emailPlaceholder')
    ).not.toBeInTheDocument()
  })

  it.each(['response', 'network'])(
    'keeps input on %s failure and retries',
    async (failure) => {
      if (failure === 'response')
        api.mockResolvedValueOnce(new Response(null, { status: 503 }))
      else api.mockRejectedValueOnce(new Error('offline'))
      api.mockResolvedValueOnce(new Response('{}'))
      render(<ForgotPasswordPage />)
      const email = screen.getByPlaceholderText('emailPlaceholder')
      fireEvent.change(email, { target: { value: 'learner@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'submit' }))
      expect(await screen.findByText(/error/)).toBeInTheDocument()
      expect(email).toHaveValue('learner@example.com')
      fireEvent.click(screen.getByRole('button', { name: 'submit' }))
      expect(await screen.findByText('sent')).toBeInTheDocument()
      expect(api).toHaveBeenCalledTimes(2)
    }
  )
})
