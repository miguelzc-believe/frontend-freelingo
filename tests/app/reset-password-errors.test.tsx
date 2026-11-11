import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ResetPasswordPage from '@/app/(auth)/reset-password/page'

const { apiFetch, navigation } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  navigation: { token: 'valid', push: vi.fn() },
}))

vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () =>
    new URLSearchParams(navigation.token ? `token=${navigation.token}` : ''),
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}))

describe('reset password errors', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    navigation.push.mockReset()
    navigation.token = 'valid'
  })

  it.each([
    [400, 'Invalid or expired reset token', 'auth.resetPassword.error'],
    [422, 'Password validation failed', 'auth.register.invalidPassword'],
    [503, 'Service unavailable', 'common.errorMessage'],
  ])(
    'localizes HTTP %i without exposing the backend detail',
    async (status, detail, message) => {
      apiFetch.mockResolvedValue(
        new Response(JSON.stringify({ detail }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      render(<ResetPasswordPage />)

      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.newPassword'),
        {
          target: { value: 'ValidPwd12!' },
        }
      )
      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.confirmPassword'),
        {
          target: { value: 'ValidPwd12!' },
        }
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.queryByText(detail)).toBeNull()
    }
  )

  it.each([
    ['Valid12!', 'auth.resetPassword.tooShort'],
    ['Valid123!', 'auth.resetPassword.tooShort'],
    [`A1!${'😀'.repeat(6)}`, 'auth.resetPassword.tooShort'],
    [`A1!${'a'.repeat(23)}`, 'auth.register.invalidPassword'],
  ])(
    'rejects an invalid password length before submitting: %s',
    async (password, message) => {
      render(<ResetPasswordPage />)
      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.newPassword'),
        {
          target: { value: password },
        }
      )
      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.confirmPassword'),
        {
          target: { value: password },
        }
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(apiFetch).not.toHaveBeenCalled()
    }
  )

  it.each(['Abcdefg1!?', `A1!${'a'.repeat(22)}`, `A1!${'😀'.repeat(22)}`])(
    'submits a password within the backend length limits: %s',
    async (password) => {
      apiFetch.mockResolvedValue(new Response(null, { status: 503 }))
      render(<ResetPasswordPage />)
      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.newPassword'),
        {
          target: { value: password },
        }
      )
      fireEvent.change(
        screen.getByPlaceholderText('auth.resetPassword.confirmPassword'),
        {
          target: { value: password },
        }
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'auth.resetPassword.submit' })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'common.errorMessage'
      )
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          body: JSON.stringify({ token: 'valid', new_password: password }),
        })
      )
    }
  )

  it('shows the translated password requirements before submission', () => {
    render(<ResetPasswordPage />)

    expect(
      screen.getByPlaceholderText('auth.resetPassword.newPassword')
    ).toHaveAccessibleDescription('auth.register.invalidPassword')
  })

  it('disables submission when the reset token is missing', () => {
    navigation.token = ''
    render(<ResetPasswordPage />)
    expect(
      screen.getByText('auth.resetPassword.missingToken')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'auth.resetPassword.submit' })
    ).toBeDisabled()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without making a request', async () => {
    render(<ResetPasswordPage />)
    fireEvent.change(
      screen.getByPlaceholderText('auth.resetPassword.newPassword'),
      { target: { value: 'ValidPwd12!' } }
    )
    fireEvent.change(
      screen.getByPlaceholderText('auth.resetPassword.confirmPassword'),
      { target: { value: 'DifferentPwd12!' } }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'auth.resetPassword.submit' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'auth.resetPassword.mismatch'
    )
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('shows success and redirects to login after two seconds', async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))
    render(<ResetPasswordPage />)
    fireEvent.change(
      screen.getByPlaceholderText('auth.resetPassword.newPassword'),
      { target: { value: 'ValidPwd12!' } }
    )
    fireEvent.change(
      screen.getByPlaceholderText('auth.resetPassword.confirmPassword'),
      { target: { value: 'ValidPwd12!' } }
    )
    vi.useFakeTimers()
    try {
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'auth.resetPassword.submit' })
        )
      })
      expect(screen.getByText('auth.resetPassword.success')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(navigation.push).toHaveBeenCalledWith('/login')
    } finally {
      vi.useRealTimers()
    }
  })
})
