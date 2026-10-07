import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  logout: vi.fn(),
  push: vi.fn(),
  state: { user: { role: 'learner' } },
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/store/auth', () => ({
  useAuthStore: (
    selector: (state: typeof mocks.state & { logout: () => void }) => unknown
  ) => selector({ ...mocks.state, logout: mocks.logout }),
}))
vi.mock('@/hooks/useLogout', () => ({ useLogout: () => vi.fn() }))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/settings/ProfileSection', () => ({
  ProfileSection: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('@/components/settings/ConversationSection', () => ({
  ConversationSection: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('@/components/settings/VoiceSection', () => ({
  VoiceSection: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('@/components/settings/AppearanceSection', () => ({
  AppearanceSection: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('@/components/settings/BillingSection', () => ({
  BillingSection: () => <div>billingSection</div>,
}))
vi.mock('@/components/settings/AiSection', () => ({
  AiSection: () => <div>aiSection</div>,
}))
vi.mock('@/components/settings/VoiceProviderSettings', () => ({
  VoiceProviderSettings: () => <div>voiceProviderSettings</div>,
}))
vi.mock('@/components/settings/ReviewSection', () => ({
  ReviewSection: ({ title }: { title: string }) => <div>{title}</div>,
}))

import SettingsPage from '@/app/(app)/settings/page'

const quota = {
  sessions_this_week: 2,
  sessions_limit: 5,
  sessions_unlimited: false,
  minutes_today: 12,
  minutes_limit: 30,
  time_unlimited: false,
  minutes_this_week: 45,
  weekly_minutes_limit: 40,
  weekly_minutes_unlimited: false,
  tokens_this_month: 2300,
  tokens_monthly_limit: 10000,
  tokens_unlimited: false,
}

function setup() {
  mocks.apiFetch.mockImplementation((path: string) =>
    Promise.resolve({
      json: () => Promise.resolve(path === '/api/auth/quota' ? quota : {}),
    })
  )
  return render(<SettingsPage />)
}

describe('settings page', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    mocks.logout.mockReset()
    mocks.push.mockReset()
  })

  it('renders settings navigation, section anchors, and account-management links', async () => {
    setup()
    expect(
      screen.getByRole('heading', { level: 1, name: 'title' })
    ).toBeInTheDocument()
    for (const [label, id] of [
      ['sectionAccount', 'account'],
      ['sectionAi', 'ai'],
      ['sectionAppearance', 'preferences'],
      ['sectionConversation', 'voice'],
      ['sectionUsageLimits', 'plan'],
      ['sectionReview', 'community'],
      ['sectionLegal', 'legal'],
    ] as const) {
      expect(document.getElementById(id)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `#${id}`
      )
    }
    expect(
      screen.getByRole('link', { name: /languagesManage/ })
    ).toHaveAttribute('href', '/settings/languages')
    expect(screen.getByRole('link', { name: /memoryManage/ })).toHaveAttribute(
      'href',
      '/settings/memories'
    )
    expect(await screen.findByText('quotaHint')).toBeInTheDocument()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    expect(screen.getByText('45 / 40')).toHaveClass('text-fl-error')
    expect(screen.getByText('quotaTokens')).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/quota')
  })

  it('does not delete the account when the confirmation is opened or canceled', async () => {
    setup()
    await screen.findByText('quotaHint')
    fireEvent.click(screen.getByRole('button', { name: 'deleteAccount' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'deleteAccountTitle'
    )
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('deletes the account only after confirmation, then logs out and routes to login', async () => {
    setup()
    await screen.findByText('quotaHint')
    fireEvent.click(screen.getByRole('button', { name: 'deleteAccount' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'deleteAccountConfirm' })
    )
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'DELETE',
      })
    )
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith('/login')
  })

  it('keeps the account and dialog when deletion fails', async () => {
    setup()
    mocks.apiFetch.mockImplementation((path: string) =>
      path === '/api/auth/me'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ json: () => Promise.resolve(quota) })
    )
    await screen.findByText('quotaHint')
    fireEvent.click(screen.getByRole('button', { name: 'deleteAccount' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'deleteAccountConfirm' })
    )
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'DELETE',
      })
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'deleteAccountConfirm' })
    ).toBeEnabled()
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('opens and cancels logout confirmation without deleting the account', async () => {
    setup()
    await screen.findByText('quotaHint')
    fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'logoutConfirmTitle'
    )
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mocks.apiFetch).not.toHaveBeenCalledWith('/api/auth/me', {
      method: 'DELETE',
    })
  })
})
