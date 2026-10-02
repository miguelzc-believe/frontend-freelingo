import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

const {
  mockApiFetch,
  mockRefresh,
  mockPush,
  mockReplace,
  mockHandleLogout,
  mockLoadConfig,
} = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockRefresh: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockHandleLogout: vi.fn(),
  mockLoadConfig: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/lib/session', () => ({ refreshAccessToken: mockRefresh }))
vi.mock('@/hooks/useLogout', () => ({ useLogout: () => mockHandleLogout }))

vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))
vi.mock('@/components/AuthAvatarImage', () => ({ AuthAvatarImage: () => null }))
vi.mock('@/components/ui/loading-bar', () => ({ LoadingBar: () => null }))
vi.mock('@/components/ui/contact-form-modal', () => ({
  ContactFormModal: () => null,
}))

import AppLayout from '@/app/(app)/layout'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mePayload = {
  id: 1,
  username: 'Student',
  display_name: 'Student One',
  role: 'user',
  avatar: null,
  is_verified: true,
  learning_goals: ['travel'],
}

function mockAuthenticatedApi(me: unknown = mePayload, unreadCount = 0) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url === '/api/auth/me') return jsonResponse(me)
    if (url === '/api/feedback/unread-summary')
      return jsonResponse({ unread_count: unreadCount })
    if (url === '/api/auth/resend-verification') return jsonResponse({})
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

function renderLayout() {
  return render(
    <AppLayout>
      <div>page-content</div>
    </AppLayout>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  mockApiFetch.mockReset()
  mockRefresh.mockReset()
  mockPush.mockReset()
  mockReplace.mockReset()
  mockHandleLogout.mockReset()
  mockLoadConfig.mockReset()
  useAuthStore.setState({ accessToken: null, user: null })
  useConfigStore.setState({ stripeEnabled: false, load: mockLoadConfig })
})

describe('AppLayout', () => {
  it('shows the initializing screen while the session is restored', () => {
    mockRefresh.mockReturnValue(new Promise(() => {}))
    renderLayout()
    expect(
      screen.getByRole('status', { name: 'initializing' })
    ).toBeInTheDocument()
    expect(screen.queryByText('page-content')).not.toBeInTheDocument()
  })

  it('redirects to login when the refresh cookie cannot restore a session', async () => {
    mockRefresh.mockResolvedValue(null)
    renderLayout()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('restores the session, loads the user and renders navigation', async () => {
    mockRefresh.mockResolvedValue('fresh-token')
    mockAuthenticatedApi(mePayload, 3)
    renderLayout()
    expect(await screen.findByText('page-content')).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockLoadConfig).toHaveBeenCalled()
    expect(screen.getByText('@student')).toBeInTheDocument()
    expect(screen.getAllByText('home').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.queryByText('admin')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('skips the refresh call when an access token is already in memory', async () => {
    useAuthStore.setState({ accessToken: 'cached-token' })
    mockAuthenticatedApi()
    renderLayout()
    expect(await screen.findByText('page-content')).toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('redirects to login when the profile request fails', async () => {
    useAuthStore.setState({ accessToken: 'cached-token' })
    mockApiFetch.mockResolvedValue(jsonResponse({}, 401))
    renderLayout()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('sends users without learning goals to onboarding', async () => {
    mockRefresh.mockResolvedValue('fresh-token')
    mockAuthenticatedApi({ ...mePayload, learning_goals: null })
    renderLayout()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'))
  })

  it('shows the admin entry for admin users', async () => {
    mockRefresh.mockResolvedValue('fresh-token')
    mockAuthenticatedApi({ ...mePayload, role: 'admin' })
    renderLayout()
    await screen.findByText('page-content')
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('resends the verification email from the banner', async () => {
    mockRefresh.mockResolvedValue('fresh-token')
    mockAuthenticatedApi({ ...mePayload, is_verified: false })
    renderLayout()
    fireEvent.click(
      await screen.findByRole('button', { name: 'resendVerification' })
    )
    expect(await screen.findByText('verifyEmailSent')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
      method: 'POST',
    })
  })

  it('confirms logout through the dialog and invokes the logout handler', async () => {
    mockRefresh.mockResolvedValue('fresh-token')
    mockAuthenticatedApi()
    renderLayout()
    fireEvent.click(await screen.findByRole('button', { name: 'logout' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('logoutConfirmMessage')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'logout' }))
    expect(mockHandleLogout).toHaveBeenCalledTimes(1)
  })

  it('clears a cached token and redirects when loading the profile throws', async () => {
    useAuthStore.setState({ accessToken: 'cached-token' })
    mockApiFetch.mockRejectedValue(new Error('profile request failed'))

    renderLayout()

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('ignores a refresh result that arrives after unmount', async () => {
    const refresh = deferred<string | null>()
    mockRefresh.mockReturnValue(refresh.promise)
    const view = renderLayout()

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => {
      refresh.resolve(null)
      await refresh.promise
    })

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(mockHandleLogout).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('ignores a profile response that arrives after unmount', async () => {
    const profileResponse = deferred<Response>()
    useAuthStore.setState({ accessToken: 'cached-token' })
    mockApiFetch.mockReturnValue(profileResponse.promise)
    const view = renderLayout()

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/me')
    )
    view.unmount()
    await act(async () => {
      profileResponse.resolve(jsonResponse(mePayload))
      await profileResponse.promise
    })

    expect(useAuthStore.getState().user).toBeNull()
    expect(mockHandleLogout).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('ignores profile JSON that arrives after unmount', async () => {
    const profileData = deferred<unknown>()
    const json = vi.fn(() => profileData.promise)
    useAuthStore.setState({ accessToken: 'cached-token' })
    mockApiFetch.mockResolvedValue({ ok: true, json })
    const view = renderLayout()

    await waitFor(() => expect(json).toHaveBeenCalledTimes(1))
    view.unmount()
    await act(async () => {
      profileData.resolve({ ...mePayload, learning_goals: null })
      await profileData.promise
    })

    expect(useAuthStore.getState().user).toBeNull()
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
    expect(mockHandleLogout).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('refreshes the feedback badge on feedback-read and removes the listener on unmount', async () => {
    let summaryRequests = 0
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') return jsonResponse(mePayload)
      if (url === '/api/feedback/unread-summary') {
        summaryRequests += 1
        return jsonResponse({ unread_count: summaryRequests === 1 ? 2 : 7 })
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    useAuthStore.setState({ accessToken: 'cached-token' })
    const view = renderLayout()

    expect(await screen.findByText('2')).toBeInTheDocument()
    await act(async () => {
      window.dispatchEvent(new Event('freelingo:feedback-read'))
    })
    expect(await screen.findByText('7')).toBeInTheDocument()
    expect(summaryRequests).toBe(2)

    view.unmount()
    await act(async () => {
      window.dispatchEvent(new Event('freelingo:feedback-read'))
    })
    expect(summaryRequests).toBe(2)
  })
})
