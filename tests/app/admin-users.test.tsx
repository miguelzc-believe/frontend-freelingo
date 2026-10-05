import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
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

async function openCreateUserForm(username = 'New User') {
  render(<AdminUsersPage />)
  await screen.findByRole('row', { name: /Ada Lovelace|New User/ })
  fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
  fireEvent.change(screen.getByLabelText('fieldUsername'), {
    target: { value: username },
  })
  fireEvent.change(screen.getByLabelText('fieldEmail'), {
    target: { value: 'new@example.com' },
  })
  fireEvent.change(screen.getByLabelText('fieldPassword'), {
    target: { value: 'password123' },
  })
  fireEvent.change(screen.getByLabelText('fieldDisplayName'), {
    target: { value: 'New User' },
  })
  return screen.getByRole('dialog', { name: 'createUser' })
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }),
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      }),
    })
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

  it.each([
    ['trialing', 'statusTrialing'],
    ['past_due', 'statusPastDue'],
    ['unpaid', 'statusUnpaid'],
    ['paused', 'statusPaused'],
    ['incomplete', 'statusIncomplete'],
    ['incomplete_expired', 'statusIncompleteExpired'],
    ['canceled', 'statusCanceled'],
    ['none', 'statusNone'],
    ['unknown', 'statusNone'],
  ])('renders the billing label and badge for %s', async (status, label) => {
    mockApiFetch.mockResolvedValue(
      listResponse([{ ...user, subscription_status: status }])
    )

    render(<AdminUsersPage />)

    expect(await screen.findAllByText(label)).not.toHaveLength(0)
  })

  it('renders multiple active and inactive users, including the current admin', async () => {
    mockApiFetch.mockResolvedValue(
      listResponse(
        [
          { ...user, id: 1, display_name: 'Current Admin', role: 'admin' },
          {
            ...user,
            id: 18,
            display_name: 'Inactive Learner',
            email: '',
            is_active: false,
            subscription_status: 'unknown',
          },
        ],
        2
      )
    )

    render(<AdminUsersPage />)

    expect(
      await screen.findByRole('row', { name: /Current Admin/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /Inactive Learner/ })
    ).toBeInTheDocument()
    expect(screen.getByText('2 total')).toBeInTheDocument()
    expect(screen.getAllByText('roleAdmin').length).toBeGreaterThan(0)
    expect(screen.getAllByText('inactive').length).toBeGreaterThan(0)
  })

  it('hides subscription data and filters when Stripe is disabled', async () => {
    useConfigStore.setState({ stripeEnabled: false, maintenanceMode: false })

    render(<AdminUsersPage />)

    await screen.findByRole('row', { name: /Ada Lovelace/ })
    expect(screen.queryByText('fieldSubscription')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'subscriptionFilter' })
    ).not.toBeInTheDocument()
  })

  it('generates and copies an invite link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/invite'
        ? jsonResponse({ invite_url: '/register?invite=abc' })
        : listResponse()
    )

    render(<AdminUsersPage />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    fireEvent.click(screen.getByRole('button', { name: 'inviteBtn' }))

    const inviteLink = 'http://localhost:3000/register?invite=abc'
    expect(await screen.findByText(inviteLink)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'copyLink' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(inviteLink)
      expect(
        screen.getByRole('button', { name: 'inviteCopied' })
      ).toBeInTheDocument()
    })
  })

  it('shows an invite generation error when the request fails', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/invite' ? jsonResponse({}, 500) : listResponse()
    )

    render(<AdminUsersPage />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    fireEvent.click(screen.getByRole('button', { name: 'inviteBtn' }))

    expect(await screen.findByText('inviteError')).toBeInTheDocument()
    expect(screen.queryByText('inviteLink')).not.toBeInTheDocument()
  })

  it('shows an error when copying an invite link fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')),
      },
    })
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/invite'
        ? jsonResponse({ invite_url: '/register?invite=abc' })
        : listResponse()
    )

    render(<AdminUsersPage />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    fireEvent.click(screen.getByRole('button', { name: 'inviteBtn' }))
    await screen.findByText('http://localhost:3000/register?invite=abc')
    fireEvent.click(screen.getByRole('button', { name: 'copyLink' }))

    expect(await screen.findByText('copyInviteError')).toBeInTheDocument()
  })

  it('loads the next user page with the appropriate offset', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      return listResponse(
        [
          {
            ...user,
            id: params.get('skip') === '10' ? 18 : user.id,
            display_name:
              params.get('skip') === '10' ? 'Page Two' : user.display_name,
          },
        ],
        11
      )
    })

    render(<AdminUsersPage />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))

    expect(
      await screen.findByRole('row', { name: /Page Two/ })
    ).toBeInTheDocument()
    await waitFor(() => expect(latestUsersParams().get('skip')).toBe('10'))
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

  it('shows the authorization error when the user list is forbidden', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}, 403))

    render(<AdminUsersPage />)

    expect(await screen.findByText('adminRequired')).toBeInTheDocument()
    expect(screen.getByText('noUsers')).toBeInTheDocument()
  })

  it('shows a load error when the user list request rejects', async () => {
    mockApiFetch.mockRejectedValue(new Error('network unavailable'))

    render(<AdminUsersPage />)

    expect(await screen.findByText('usersLoadError')).toBeInTheDocument()
    expect(screen.getByText('noUsers')).toBeInTheDocument()
  })

  it('opens a native modal with browser-owned light dismissal', async () => {
    const dialog = await openCreateUserForm()
    expect(dialog.tagName).toBe('DIALOG')
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1)
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveClass(
      'border-fl-border',
      'bg-fl-surface',
      'max-h-[calc(100vh-2rem)]',
      'w-full',
      'max-w-md',
      'overflow-y-auto',
      'border',
      'shadow-2xl',
      'p-0',
      'm-auto',
      'inset-0'
    )
    expect(dialog).toHaveStyle({ width: 'calc(100% - 2rem)' })
    expect(screen.queryByRole('button', { name: 'close' })).toBeNull()
    expect(dialog.closest('button, [role="button"]')).toBeNull()
    expect(dialog).toHaveAttribute('closedby', 'any')
    // jsdom has no native light-dismiss algorithm; browser coverage clicks outside.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog', { name: 'createUser' })).toBeNull()
  })

  it('fallback distinguishes panel padding from an outside click and removes its listener', async () => {
    const view = await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
    const dialog = screen.getByRole('dialog')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 20,
      left: 20,
      top: 20,
      right: 200,
      bottom: 200,
      width: 180,
      height: 180,
      toJSON: () => ({}),
    })
    fireEvent.click(dialog, { clientX: 30, clientY: 30 })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(dialog, { clientX: 2, clientY: 2 })
    expect(screen.queryByRole('dialog')).toBeNull()
    const closes = vi.mocked(HTMLDialogElement.prototype.close).mock.calls
      .length
    fireEvent.click(dialog, { clientX: 2, clientY: 2 })
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(closes)
    view.unmount()
  })

  it('keeps the dialog open for panel, field and select interactions', async () => {
    const dialog = await openCreateUserForm()
    const field = within(dialog).getByLabelText('fieldUsername')
    const role = within(dialog).getByLabelText('fieldRole')

    fireEvent.click(within(dialog).getByText('createUserSheetDesc'))
    fireEvent.click(field)
    fireEvent.change(field, { target: { value: 'Changed User' } })
    fireEvent.click(role)
    fireEvent.change(role, { target: { value: 'admin' } })

    expect(dialog).toBeInTheDocument()
    expect(field).toHaveValue('Changed User')
    expect(role).toHaveValue('admin')
  })

  it('closes on native cancel and can reopen', async () => {
    await openCreateUserForm()
    const field = screen.getByLabelText('fieldEmail')
    field.focus()

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    )

    expect(screen.queryByRole('dialog', { name: 'createUser' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
    expect(
      screen.getByRole('dialog', { name: 'createUser' })
    ).toBeInTheDocument()
  })

  it('syncs native close and safely unmounts an open dialog', async () => {
    const view = await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
    const dialog = screen.getByRole('dialog') as HTMLDialogElement
    dialog.close()
    fireEvent(dialog, new Event('close'))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
    expect(() => view.unmount()).not.toThrow()
  })

  it.each(['backdrop', 'header', 'cancel', 'Escape'])(
    'preserves %s dismissal while creation is pending',
    async (action) => {
      let resolveCreate!: (response: Response) => void
      const pendingCreate = new Promise<Response>((resolve) => {
        resolveCreate = resolve
      })
      mockApiFetch.mockImplementation((url: string) =>
        url === '/api/admin/users'
          ? pendingCreate
          : Promise.resolve(listResponse())
      )
      const dialog = await openCreateUserForm()
      const submit = within(dialog).getByRole('button', {
        name: 'submitCreate',
      })
      const cancelButtons = within(dialog).getAllByRole('button', {
        name: 'cancel',
      })
      fireEvent.click(submit)

      expect(submit).toBeDisabled()
      expect(screen.getByLabelText('fieldUsername')).toBeEnabled()
      expect(cancelButtons[0]).toBeEnabled()
      expect(cancelButtons[1]).toBeEnabled()
      if (action === 'Escape') {
        fireEvent(dialog, new Event('cancel', { cancelable: true }))
      } else if (action === 'backdrop') {
        expect(dialog).toHaveAttribute('closedby', 'any')
        fireEvent(dialog, new Event('cancel', { cancelable: true }))
      } else {
        fireEvent.click(cancelButtons[action === 'header' ? 0 : 1]!)
      }
      expect(screen.queryByRole('dialog', { name: 'createUser' })).toBeNull()
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'new_user',
            email: 'new@example.com',
            password: 'password123',
            display_name: 'New User',
            native_language: 'es',
            target_language: 'en-GB',
            role: 'user',
          }),
        })
      )
      await act(async () => {
        resolveCreate(jsonResponse({}, 503))
        await pendingCreate
      })
      expect(await screen.findByText('createUserError')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'createUser' })).toBeNull()
    }
  )

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

    expect(await screen.findAllByText('usernameTaken')).toHaveLength(2)
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

  it('rejects invalid username characters without posting', async () => {
    const dialog = await openCreateUserForm('bad/name')

    fireEvent.click(screen.getByRole('button', { name: 'submitCreate' }))

    expect(
      await within(dialog).findByText('invalidUsernameChars')
    ).toBeInTheDocument()
    expect(
      mockApiFetch.mock.calls.filter(
        ([url, options]) =>
          url === '/api/admin/users' && options?.method === 'POST'
      )
    ).toHaveLength(0)
    expect(dialog).toBeInTheDocument()
  })

  it('shows the specific email conflict and keeps the create dialog open', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/users'
        ? jsonResponse({ detail: 'Email already taken' }, 409)
        : listResponse()
    )
    const dialog = await openCreateUserForm()

    fireEvent.click(screen.getByRole('button', { name: 'submitCreate' }))

    expect(await within(dialog).findByText('emailTaken')).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  it('shows a generic create error for other non-OK responses and keeps the dialog open', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/users' ? jsonResponse({}, 503) : listResponse()
    )
    const dialog = await openCreateUserForm()

    fireEvent.click(screen.getByRole('button', { name: 'submitCreate' }))

    expect(
      await within(dialog).findByText('createUserError')
    ).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  it('creates with a normalized username, closes and resets the form, then reloads users', async () => {
    const createdUser = {
      ...user,
      username: 'new_user',
      email: 'new@example.com',
      display_name: 'New User',
    }
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/admin/users'
        ? jsonResponse(createdUser)
        : listResponse([createdUser])
    )
    await openCreateUserForm('New User')
    const initialListCalls = usersCalls().length

    fireEvent.click(screen.getByRole('button', { name: 'submitCreate' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'createUser' })).toBeNull()
    )
    expect(
      await screen.findByRole('row', { name: /New User/ })
    ).toBeInTheDocument()
    expect(usersCalls()).toHaveLength(initialListCalls + 1)
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/users',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"username":"new_user"'),
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'createUserBtn' }))
    expect(screen.getByLabelText('fieldUsername')).toHaveValue('')
    expect(screen.getByLabelText('fieldEmail')).toHaveValue('')
    expect(screen.getByLabelText('fieldPassword')).toHaveValue('')
    expect(screen.getByLabelText('fieldDisplayName')).toHaveValue('')
  })

  it('cancels deleting a user without sending a delete request', async () => {
    const { row } = await renderLoadedPage()
    const initialListCalls = usersCalls().length

    fireEvent.click(row.getByRole('button', { name: 'delete' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'deleteUser' })).getByRole(
        'button',
        { name: 'cancel' }
      )
    )

    expect(screen.queryByRole('alertdialog', { name: 'deleteUser' })).toBeNull()
    expect(
      mockApiFetch.mock.calls.filter(
        ([, options]) => options?.method === 'DELETE'
      )
    ).toHaveLength(0)
    expect(usersCalls()).toHaveLength(initialListCalls)
  })

  it('deletes the selected user and reloads the list', async () => {
    let deleted = false
    mockApiFetch.mockImplementation(
      async (_url: string, options?: RequestInit) => {
        if (options?.method === 'DELETE') {
          deleted = true
          return jsonResponse({})
        }
        return deleted ? listResponse([], 0) : listResponse()
      }
    )
    const { row } = await renderLoadedPage()
    const initialListCalls = usersCalls().length

    fireEvent.click(row.getByRole('button', { name: 'delete' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'deleteUser' })).getByRole(
        'button',
        { name: 'deleteConfirm' }
      )
    )

    await waitFor(() => expect(usersCalls()).toHaveLength(initialListCalls + 1))
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/users/17', {
      method: 'DELETE',
    })
    expect(screen.queryByRole('alertdialog', { name: 'deleteUser' })).toBeNull()
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Ada Lovelace/ })).toBeNull()
    )
    expect(screen.getByText('noUsers')).toBeInTheDocument()
  })

  it('shows a delete error and does not reload the list after failure', async () => {
    const { row } = await renderLoadedPage()
    const initialListCalls = usersCalls().length
    mockApiFetch.mockImplementation(
      async (_url: string, options?: RequestInit) =>
        options?.method === 'DELETE' ? jsonResponse({}, 500) : listResponse()
    )

    fireEvent.click(row.getByRole('button', { name: 'delete' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'deleteUser' })).getByRole(
        'button',
        { name: 'deleteConfirm' }
      )
    )

    expect(await screen.findByText('deleteUserError')).toBeInTheDocument()
    expect(usersCalls()).toHaveLength(initialListCalls)
  })

  it('reports a failed activation and does not reload the list', async () => {
    const { row } = await renderLoadedPage()
    const initialCalls = usersCalls().length
    mockApiFetch.mockImplementation(async (url: string) =>
      String(url).includes('/17') ? jsonResponse({}, 500) : listResponse()
    )

    fireEvent.click(row.getByRole('button', { name: 'deactivate' }))
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'deactivateUser' })
      ).getByRole('button', { name: 'deactivate' })
    )

    expect(await screen.findByText('updateUserError')).toBeInTheDocument()
    expect(usersCalls()).toHaveLength(initialCalls)
  })
})
