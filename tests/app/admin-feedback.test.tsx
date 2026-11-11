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

const { mockApiFetch, mockSearchParams, translations } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  translations: {
    feedback: (key: string) => key,
    admin: (key: string) => key,
  },
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: 'feedback' | 'admin') => translations[namespace],
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
        <button onClick={onConfirm}>confirm delete</button>
        <button onClick={onCancel}>cancel delete</button>
      </div>
    ) : null,
}))

import AdminFeedbackPage from '@/app/(app)/admin/feedback/page'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const entry = {
  id: 17,
  type: 'feature',
  title: 'Offline lesson downloads',
  description: 'Keep a lesson available while travelling.',
  status: 'pending',
  author: {
    id: 8,
    username: 'alex',
    display_name: 'Alex Learner',
    role: 'user',
  },
  vote_count: 12,
  comment_count: 3,
  created_at: '2025-01-15T12:00:00Z',
}

function feedbackResponse(items = [entry], total = items.length) {
  return jsonResponse({ items, total, skip: 0, limit: 10 })
}

function getFeedbackRow(container: HTMLElement) {
  return within(container).getByRole('row', {
    name: /Offline lesson downloads/,
  })
}

async function renderLoadedPage() {
  const view = render(<AdminFeedbackPage />)
  const row = await within(view.container).findByRole('row', {
    name: /Offline lesson downloads/,
  })
  return { ...view, row }
}

function setFilter(name: string, value: string) {
  fireEvent.change(screen.getByRole('combobox', { name }), {
    target: { value },
  })
}

describe('AdminFeedbackPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset().mockImplementation(async () => feedbackResponse())
    for (const key of Array.from(mockSearchParams.keys())) {
      mockSearchParams.delete(key)
    }
  })

  it('shows the loading state until the list request completes', async () => {
    const pendingRequests: Array<(response: Response) => void> = []
    mockApiFetch.mockImplementation((url: string) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      if (params.get('limit') === '1')
        return Promise.resolve(feedbackResponse([], 0))
      return new Promise<Response>((resolve) => pendingRequests.push(resolve))
    })

    const { container } = render(<AdminFeedbackPage />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(pendingRequests.length).toBeGreaterThan(0))
    await act(async () => {
      for (const resolve of pendingRequests) resolve(feedbackResponse())
    })
    expect(getFeedbackRow(container)).toBeInTheDocument()
    expect(screen.queryByText('loading')).toBeNull()
  })

  it('renders totals, author, feedback details and status options', async () => {
    const { row } = await renderLoadedPage()
    expect(within(row).getByText(/Alex Learner/)).toBeInTheDocument()
    expect(
      within(row).getByText('Keep a lesson available while travelling.')
    ).toBeInTheDocument()
    expect(within(row).getByText(/▲\s*12/)).toBeInTheDocument()
    expect(within(row).getByText(/◌\s*3/)).toBeInTheDocument()
    expect(screen.getByText('feedbackTotal')).toBeInTheDocument()
    expect(
      within(row).getByRole('combobox', { name: 'feedbackStatusAction' })
    ).toHaveValue('pending')
  })

  it('updates only the selected entry when multiple feedback items are displayed', async () => {
    const other = { ...entry, id: 18, title: 'Another request' }
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) =>
        options?.method === 'PATCH'
          ? jsonResponse({})
          : feedbackResponse([entry, other])
    )
    const { row } = await renderLoadedPage()
    fireEvent.change(
      within(row).getByRole('combobox', { name: 'feedbackStatusAction' }),
      { target: { value: 'planned' } }
    )
    await waitFor(() =>
      expect(
        within(row).getByRole('combobox', { name: 'feedbackStatusAction' })
      ).toHaveValue('planned')
    )
    const otherRow = screen.getByRole('row', { name: /Another request/ })
    expect(
      within(otherRow).getByRole('combobox', { name: 'feedbackStatusAction' })
    ).toHaveValue('pending')
  })

  it('returns to the first page when a status filter changes on later results', async () => {
    mockApiFetch.mockImplementation(async () => feedbackResponse([entry], 11))
    await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) => String(url).includes('skip=10'))
      ).toBe(true)
    )
    const before = mockApiFetch.mock.calls.length
    setFilter('filterStatus', 'planned')
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls
          .slice(before)
          .some(
            ([url]) =>
              String(url).includes('skip=0') &&
              String(url).includes('status=planned')
          )
      ).toBe(true)
    )
  })

  it('renders bug entries and preserves unfamiliar status labels on desktop and mobile', async () => {
    const bug = {
      ...entry,
      id: 18,
      type: 'bug',
      status: 'legacy',
      title: 'Playback issue',
    }
    mockApiFetch.mockImplementation(async () =>
      feedbackResponse([entry, bug], 2)
    )
    const { container } = render(<AdminFeedbackPage />)
    const row = await screen.findByRole('row', { name: /Playback issue/ })
    expect(within(row).getByText('tabBugs')).toBeInTheDocument()
    expect(within(row).getByText('legacy')).toBeInTheDocument()
    const mobile = container.querySelector('.lg\\:hidden')!
    expect(
      within(mobile as HTMLElement).getByText('tabBugs')
    ).toBeInTheDocument()
    expect(
      within(mobile as HTMLElement).getByText('legacy')
    ).toBeInTheDocument()
  })

  it('submits a search with Enter but not other keys', async () => {
    await renderLoadedPage()
    const input = screen.getByPlaceholderText('feedbackSearchPlaceholder')
    fireEvent.change(input, { target: { value: 'offline' } })
    const before = mockApiFetch.mock.calls.length
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockApiFetch).toHaveBeenCalledTimes(before)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls
          .slice(before)
          .some(([url]) => String(url).includes('q=offline'))
      ).toBe(true)
    )
  })

  it('keeps the list available when category totals fail or omit a total', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      const params = new URL(url, 'http://localhost').searchParams
      if (params.get('limit') === '1') {
        return params.get('type') === 'feature'
          ? jsonResponse({}, 503)
          : jsonResponse({})
      }
      return feedbackResponse()
    })
    const { row } = await renderLoadedPage()
    expect(
      within(row).getByText('Offline lesson downloads')
    ).toBeInTheDocument()
    expect(screen.queryByText('errorLoad')).not.toBeInTheDocument()
  })

  it('initializes valid filters from the URL and rejects invalid values', async () => {
    mockSearchParams.set('type', 'bug')
    mockSearchParams.set('status', 'done')
    mockSearchParams.set('sort', 'votes')
    const view = render(<AdminFeedbackPage />)
    await screen.findByRole('row', { name: /Offline lesson downloads/ })
    expect(
      screen.getByRole('combobox', { name: 'feedbackTypeFilter' })
    ).toHaveValue('bug')
    expect(screen.getByRole('combobox', { name: 'filterStatus' })).toHaveValue(
      'done'
    )
    expect(screen.getByRole('combobox', { name: 'sortBy' })).toHaveValue(
      'votes'
    )
    view.unmount()
    mockSearchParams.set('type', 'unknown')
    mockSearchParams.set('status', 'unknown')
    mockSearchParams.set('sort', 'unknown')
    render(<AdminFeedbackPage />)
    await screen.findByRole('row', { name: /Offline lesson downloads/ })
    expect(
      screen.getByRole('combobox', { name: 'feedbackTypeFilter' })
    ).toHaveValue('all')
    expect(screen.getByRole('combobox', { name: 'filterStatus' })).toHaveValue(
      ''
    )
    expect(screen.getByRole('combobox', { name: 'sortBy' })).toHaveValue('date')
  })

  it('renders an empty-list message after a successful empty response', async () => {
    mockApiFetch.mockResolvedValue(feedbackResponse([], 0))

    render(<AdminFeedbackPage />)

    expect(await screen.findByText('noEntries')).toBeInTheDocument()
    expect(screen.queryByText('noFilteredFeedback')).toBeNull()
  })

  it('shows the admin-required message for a forbidden list request', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}, 403))

    render(<AdminFeedbackPage />)

    expect(await screen.findByText('adminRequired')).toBeInTheDocument()
    expect(screen.getByText('noEntries')).toBeInTheDocument()
  })

  it('shows the load error when a list request fails', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}, 503))

    render(<AdminFeedbackPage />)

    expect(await screen.findByText('errorLoad')).toBeInTheDocument()
  })

  it('sends trimmed search and selected filters, then supports clearing them', async () => {
    await renderLoadedPage()

    fireEvent.change(screen.getByPlaceholderText('feedbackSearchPlaceholder'), {
      target: { value: '  offline  ' },
    })
    setFilter('feedbackTypeFilter', 'bug')
    setFilter('filterStatus', 'planned')
    setFilter('sortBy', 'votes')
    fireEvent.click(
      screen.getByRole('button', { name: 'feedbackSearchAction' })
    )

    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) => {
          const params = new URL(String(url), 'http://localhost').searchParams
          return (
            params.get('q') === 'offline' &&
            params.get('type') === 'bug' &&
            params.get('status') === 'planned' &&
            params.get('sort') === 'votes'
          )
        })
      ).toBe(true)
    )
    expect(screen.getByRole('button', { name: /clearFilters/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /clearFilters/i }))
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText('feedbackSearchPlaceholder')
      ).toHaveValue('')
    )
    expect(
      screen.getByRole('combobox', { name: 'feedbackTypeFilter' })
    ).toHaveValue('all')
    expect(screen.getByRole('combobox', { name: 'filterStatus' })).toHaveValue(
      ''
    )
    expect(screen.getByRole('combobox', { name: 'sortBy' })).toHaveValue('date')
  })

  it('applies a status change and reports a failed status update', async () => {
    const { row } = await renderLoadedPage()
    const status = within(row).getByRole('combobox', {
      name: 'feedbackStatusAction',
    })

    fireEvent.change(status, { target: { value: 'planned' } })
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/feedback/17/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'planned' }),
        })
      )
    )
    await waitFor(() => expect(status).toHaveValue('planned'))

    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/feedback/17/status'
        ? jsonResponse({}, 500)
        : feedbackResponse()
    )
    fireEvent.change(status, { target: { value: 'done' } })
    expect(await screen.findByText('feedbackStatusError')).toBeInTheDocument()
    expect(status).toHaveValue('planned')
  })

  it('reloads filtered entries when a status change removes the current entry', async () => {
    let updated = false
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
          updated = true
          return jsonResponse({})
        }
        return updated ? feedbackResponse([], 0) : feedbackResponse()
      }
    )
    await renderLoadedPage()
    setFilter('filterStatus', 'pending')
    const row = await screen.findByRole('row', {
      name: /Offline lesson downloads/,
    })
    fireEvent.change(
      within(row).getByRole('combobox', { name: 'feedbackStatusAction' }),
      { target: { value: 'done' } }
    )
    expect(await screen.findByText('noFilteredFeedback')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/feedback/17/status',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('returns to the first page when a search is submitted on a later page', async () => {
    mockApiFetch.mockImplementation(async () => feedbackResponse([entry], 11))
    await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) => String(url).includes('skip=10'))
      ).toBe(true)
    )
    fireEvent.change(screen.getByPlaceholderText('feedbackSearchPlaceholder'), {
      target: { value: ' offline ' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'feedbackSearchAction' })
    )
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(
          ([url]) =>
            String(url).includes('skip=0') && String(url).includes('q=offline')
        )
      ).toBe(true)
    )
  })

  it('returns to the previous page when deleting its last item', async () => {
    let deleted = false
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === 'DELETE') {
          deleted = true
          return jsonResponse({})
        }
        return feedbackResponse([entry], deleted ? 10 : 11)
      }
    )
    await renderLoadedPage()
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) => String(url).includes('skip=10'))
      ).toBe(true)
    )
    const row = await screen.findByRole('row', {
      name: /Offline lesson downloads/,
    })
    const callsBeforeDelete = mockApiFetch.mock.calls.length
    fireEvent.click(within(row).getByRole('button', { name: 'delete' }))
    fireEvent.click(screen.getByText('confirm delete'))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls
          .slice(callsBeforeDelete)
          .some(
            ([url]) =>
              String(url).includes('skip=0') && String(url).includes('limit=10')
          )
      ).toBe(true)
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears filters and returns to the first page from later results', async () => {
    mockApiFetch.mockImplementation(async () => feedbackResponse([entry], 11))
    await renderLoadedPage()
    setFilter('feedbackTypeFilter', 'bug')
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) =>
          String(url).includes('type=bug')
        )
      ).toBe(true)
    )
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([url]) => String(url).includes('skip=10'))
      ).toBe(true)
    )
    fireEvent.click(screen.getByRole('button', { name: /clearFilters/i }))
    expect(
      screen.getByRole('combobox', { name: 'feedbackTypeFilter' })
    ).toHaveValue('all')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'prevPage' })).toBeDisabled()
    )
  })

  it('cancels deletion, then deletes the entry after confirmation', async () => {
    let deleted = false
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/feedback/17') {
        deleted = true
        return jsonResponse({})
      }
      if (deleted) return feedbackResponse([], 0)
      return feedbackResponse()
    })
    const { row } = await renderLoadedPage()

    fireEvent.click(within(row).getByRole('button', { name: 'delete' }))
    expect(
      screen.getByRole('dialog', { name: 'deleteEntryConfirmTitle' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText('cancel delete'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(within(row).getByRole('button', { name: 'delete' }))
    fireEvent.click(screen.getByText('confirm delete'))
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/feedback/17',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
    expect(await screen.findByText('noEntries')).toBeInTheDocument()
  })

  it('keeps the entry and reports an error when deletion fails', async () => {
    mockApiFetch.mockImplementation(async (url: string) =>
      url === '/api/feedback/17' ? jsonResponse({}, 500) : feedbackResponse()
    )
    const { container, row } = await renderLoadedPage()

    fireEvent.click(within(row).getByRole('button', { name: 'delete' }))
    fireEvent.click(screen.getByText('confirm delete'))

    expect(await screen.findByText('feedbackDeleteError')).toBeInTheDocument()
    expect(getFeedbackRow(container)).toBeInTheDocument()
  })
})
