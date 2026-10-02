import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const { mockApiFetch, translate } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}))

import FeedbackPage from '@/app/(app)/feedback/page'
import { useAuthStore } from '@/store/auth'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const feature = {
  id: 10,
  type: 'feature',
  title: 'Add focused practice',
  description: 'A suggestion with unread activity.',
  status: 'pending',
  author: {
    id: 2,
    username: 'other',
    display_name: 'Other User',
    role: 'user',
  },
  vote_count: 3,
  voted_by_me: false,
  unread_by_me: true,
  comment_count: 0,
  created_at: '2026-07-04T10:00:00',
}

function listResponse(
  items: (typeof feature)[] = [feature],
  total = items.length
) {
  return jsonResponse({ items, total, skip: 0, limit: 10 })
}

describe('FeedbackPage list and entry actions', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 1,
        username: 'student',
        displayName: 'Student',
        email: 'student@example.com',
        native_language: 'en',
        ui_locale: 'en',
        role: 'user',
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
  })

  it('keeps loading until the list request settles', async () => {
    let resolveList!: (response: Response) => void
    mockApiFetch.mockImplementation(
      () => new Promise<Response>((resolve) => (resolveList = resolve))
    )

    render(<FeedbackPage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    resolveList(listResponse())

    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders empty state after a successful empty response', async () => {
    mockApiFetch.mockResolvedValue(listResponse([], 0))

    render(<FeedbackPage />)

    expect(await screen.findByText('noEntries')).toBeInTheDocument()
    expect(screen.queryByText('errorLoad')).not.toBeInTheDocument()
  })

  it('shows a load error when the server rejects the request', async () => {
    mockApiFetch.mockResolvedValue(new Response(null, { status: 503 }))

    render(<FeedbackPage />)

    expect(await screen.findByText(/errorLoad/)).toBeInTheDocument()
    // The current page also renders its empty-list message on load failure.
    expect(screen.getByText('noEntries')).toBeInTheDocument()
  })

  it('switches to bugs and sends the selected list filters', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    const bug = { ...feature, id: 11, type: 'bug', title: 'Fix audio controls' }
    mockApiFetch.mockImplementation((url: string) => {
      const isBugRequest = String(url).includes('type=bug')
      return Promise.resolve(
        isBugRequest ? listResponse([bug]) : listResponse()
      )
    })

    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'tabBugs' }))
    expect(await screen.findByText('Fix audio controls')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('type=bug&sort=votes&order=desc')
    )

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'done' },
    })
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=done')
      )
    )
  })

  it('opens an unread entry, marks it read, and shows comments', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (String(url).includes('/comments')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: 4,
                entry_id: 10,
                author: { ...feature.author, id: 1, display_name: 'Student' },
                body: 'Thanks for considering this.',
                created_at: '2026-07-05T10:00:00',
              },
            ],
          })
        )
      }
      return Promise.resolve(listResponse())
    })

    render(<FeedbackPage />)
    expect(await screen.findByText('unread')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Add focused practice'))

    expect(
      await screen.findByText('Thanks for considering this.')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback/10/read', {
        method: 'POST',
      })
    )
    expect(
      screen.getByRole('button', { name: 'backToList' })
    ).toBeInTheDocument()
  })

  it('toggles a feature vote and reflects the updated count', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (String(url).endsWith('/vote')) {
        return Promise.resolve(jsonResponse({ voted: true, vote_count: 4 }))
      }
      return Promise.resolve(listResponse())
    })

    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'voteAction' }))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback/10/vote', {
        method: 'POST',
      })
    )
    expect(await screen.findByText('4')).toBeInTheDocument()
  })
})
