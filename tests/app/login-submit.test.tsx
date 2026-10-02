import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'

const { apiFetch, push } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))

import LoginPage from '@/app/(auth)/login/page'

afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  apiFetch.mockReset()
  push.mockReset()
  useAuthStore.setState({ accessToken: null, user: null })
  useConfigStore.setState({ ...useConfigStore.getInitialState() }, true)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
})

describe('login submission', () => {
  it('posts credentials, stores the mapped session and navigates after /me', async () => {
    apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/auth/login'
          ? new Response(JSON.stringify({ access_token: 'synthetic-access' }))
          : new Response(
              JSON.stringify({
                id: 41,
                username: 'sample-learner',
                display_name: 'Sample Learner',
                email: 'learner@example.test',
              })
            )
      )
    )
    render(<LoginPage />)
    const form = document.querySelector('form')!
    const inputs = form.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'learner@example.test' } })
    fireEvent.change(inputs[1]!, { target: { value: 'synthetic-password' } })
    fireEvent.submit(form)

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'learner@example.test',
        password: 'synthetic-password',
      }),
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/auth/me')
    expect(useAuthStore.getState().accessToken).toBe('synthetic-access')
    expect(useAuthStore.getState().user).toMatchObject({
      id: 41,
      username: 'sample-learner',
      displayName: 'Sample Learner',
      email: 'learner@example.test',
    })
    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it('localizes a backend email validation detail and stays on login', async () => {
    apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ loc: ['body', 'email'], msg: 'Invalid email address' }],
        }),
        { status: 422 }
      )
    )
    render(<LoginPage />)
    const form = document.querySelector('form')!
    const inputs = form.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'not-an-email' } })
    fireEvent.change(inputs[1]!, { target: { value: 'synthetic-password' } })
    fireEvent.submit(form)

    expect(
      await screen.findByText(/auth\.login\.invalidEmail/)
    ).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it.each([
    ['', 'synthetic-password', 'emailRequired'],
    ['learner@example.test', '', 'passwordRequired'],
  ])(
    'guards empty credentials without posting',
    async (email, password, key) => {
      render(<LoginPage />)
      const form = document.querySelector('form')!
      const inputs = form.querySelectorAll('input')
      fireEvent.change(inputs[0]!, { target: { value: email } })
      fireEvent.change(inputs[1]!, { target: { value: password } })
      fireEvent.submit(form)

      expect(
        await screen.findByText(new RegExp(`auth\\.login\\.${key}`))
      ).toBeInTheDocument()
      expect(apiFetch).not.toHaveBeenCalled()
      expect(push).not.toHaveBeenCalled()
    }
  )
})
