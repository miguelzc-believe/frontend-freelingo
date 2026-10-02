import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import React from 'react'

const { mockApiFetch, mockSearchParams, translate } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  translate: (key: string) => key,
}))

vi.mock('use-intl', () => ({
  useTranslations: () => translate,
}))

vi.mock('@/lib/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))

vi.mock('@/components/admin/AdminNav', () => ({
  AdminNav: () => <nav>Admin navigation</nav>,
}))

vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label }: { label: string }) => <p>{label}</p>,
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    title: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button onClick={onConfirm}>confirm</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    ) : null,
}))

import AdminUsersPage from '@/app/(app)/admin/users/page'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useLanguageStore } from '@/store/language'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const user = {
  id: 17,
  username: 'ada',
  email: 'ada@example.com',
  display_name: 'Ada Lovelace',
  role: 'user',
  native_language: 'en',
  is_active: true,
  subscription_status: 'active',
}

function listResponse(items = [user], total = items.length) {
  return jsonResponse({ items, total, skip: 0, limit: 10 })
}

function usersCalls() {
  return mockApiFetch.mock.calls.filter(([url]) =>
    String(url).startsWith('/api/admin/users?')
  )
}

function latestUsersParams() {
  const [url] = usersCalls().at(-1) ?? []
  return new URL(String(url), 'http://localhost').searchParams
}

async function renderLoadedPage() {
  const view = render(<AdminUsersPage />)
  const row = await screen.findByRole('row', { name: /Ada Lovelace/ })
  return { ...view, row: within(row) }
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset().mockImplementation(async () => listResponse())
    for (const key of Array.from(mockSearchParams.keys())) {
      mockSearchParams.delete(key)
    }
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'admin',
        displayName: 'Admin',
        email: 'admin@example.com',
        native_language: 'en',
        ui_locale: 'en',
        role: 'admin',
        avatar: null,
        is_verified: true,
        bio: null,
        learning_goals: [],
        conversation_max_duration: 30,
        conversation_inactivity_timeout: 3,
        subscription_status: 'active',
        subscription_ends_at: null,
      },
    })
    useConfigStore.setState({ maintenanceMode: false, stripeEnabled: true })
    useLanguageStore.setState({ availableLanguageCodes: [] })
  })

  it('loads users and renders their identity, role, status and total', async () => {
    const { row } = await renderLoadedPage()

    expect(row.getByText(/@ada/)).toBeInTheDocument()
    expect(row.getByText('ada@example.com')).toBeInTheDocument()
    expect(row.getByText('roleUser')).toBeInTheDocument()
    expect(row.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('1 total')).toBeInTheDocument()
    expect(latestUsersParams().get('skip')).toBe('0')
    expect(latestUsersParams().get('limit')).toBe('10')
  })

  it('serializes trimmed search and selected filters and clears them', async () => {
    await renderLoadedPage()

    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: '  ada lovelace  ' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'roleFilter' }), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'statusFilter' }), {
      target: { value: 'false' },
    })
    fireEvent.change(
      screen.getByRole('combobox', { name: 'subscriptionFilter' }),
      { target: { value: 'past_due' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'searchAction' }))

    await waitFor(() => {
      expect(latestUsersParams().get('q')).toBe('ada lovelace')
      expect(latestUsersParams().get('role')).toBe('admin')
      expect(latestUsersParams().get('is_active')).toBe('false')
      expect(latestUsersParams().get('subscription')).toBe('past_due')
    })
    fireEvent.click(screen.getByRole('button', { name: 'clearFilters' }))
    await waitFor(() => expect(latestUsersParams().has('q')).toBe(false))
    expect(latestUsersParams().has('role')).toBe(false)
    expect(latestUsersParams().has('is_active')).toBe(false)
    expect(latestUsersParams().has('subscription')).toBe(false)
  })

  it('shows a load error for a failed list request', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}, 503))

    render(<AdminUsersPage />)

    expect(await screen.findByText('usersLoadError')).toBeInTheDocument()
    expect(screen.getByText('noUsers')).toBeInTheDocument()
  })

  it('shows a create failure and keeps the create dialog open', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/users'
        ? jsonResponse({ detail: 'Username already taken' }, 409)
        : listResponse()
    )
    render(<AdminUsersPage />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))

    fireEvent.change(screen.getByLabelText('fieldUsername'), {
      target: { value: 'Ada User' },
    })
    fireEvent.change(screen.getByLabelText('fieldEmail'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText('fieldPassword'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('fieldDisplayName'), {
      target: { value: 'Ada User' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'submitCreate' }))

    expect((await screen.findAllByText('usernameTaken')).length).toBe(2)
    expect(
      screen.getByRole('dialog', { name: 'createUser' })
    ).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/users',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('ada_user'),
      })
    )
  })

  it('reports a failed activation and does not reload the list', async () => {
    const { row } = await renderLoadedPage()
    const initialCalls = usersCalls().length
    mockApiFetch.mockImplementation(async (url: string) =>
      String(url).includes('/17') ? jsonResponse({}, 500) : listResponse()
    )

    fireEvent.click(row.getByRole('button', { name: 'deactivate' }))
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    expect(await screen.findByText('updateUserError')).toBeInTheDocument()
    expect(usersCalls()).toHaveLength(initialCalls)
  })
})
