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

  it('cancels list deletion without sending a DELETE request', async () => {
    mockApiFetch.mockResolvedValue(
      listResponse([{ ...feature, author: { ...feature.author, id: 1 } }])
    )
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'deleteEntry' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/feedback/10', {
      method: 'DELETE',
    })
    expect(screen.getByText('Add focused practice')).toBeInTheDocument()
  })

  it('confirms list deletion, updates the list and total, and reloads', async () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      ...feature,
      id: 10 + index,
      title: `Practice idea ${index + 1}`,
      author: { ...feature.author, id: 1 },
    }))
    let deleted = false
    mockApiFetch.mockImplementation(
      (_url: string, options?: { method?: string }) => {
        if (options?.method === 'DELETE') {
          deleted = true
          return Promise.resolve(jsonResponse({}))
        }
        return Promise.resolve(
          deleted
            ? listResponse(entries.slice(1), 10)
            : listResponse(entries, 11)
        )
      }
    )
    render(<FeedbackPage />)
    expect(await screen.findByText('Practice idea 1')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'deleteEntry' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'deleteEntryConfirm' }))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback/10', {
        method: 'DELETE',
      })
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Practice idea 2')).toBeInTheDocument()
    expect(screen.queryByText('Practice idea 1')).not.toBeInTheDocument()
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/feedback?type=feature&sort=votes&order=desc&skip=0&limit=10'
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

  it('posts a trimmed detail comment and confirms its deletion', async () => {
    const postedComment = {
      id: 9,
      entry_id: 10,
      author: { ...feature.author, id: 1, display_name: 'Student' },
      body: 'A clear, concise comment.',
      created_at: '2026-07-05T10:00:00',
    }
    mockApiFetch.mockImplementation(
      (url: string, options?: { method?: string }) => {
        if (String(url).endsWith('/comments') && options?.method === 'POST') {
          return Promise.resolve(jsonResponse(postedComment))
        }
        if (String(url).endsWith('/comments/9')) {
          return Promise.resolve(jsonResponse({}))
        }
        if (String(url).endsWith('/comments')) {
          return Promise.resolve(jsonResponse({ items: [] }))
        }
        return Promise.resolve(listResponse())
      }
    )

    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Add focused practice'))

    const commentInput =
      await screen.findByPlaceholderText('commentPlaceholder')
    fireEvent.change(commentInput, {
      target: { value: '  A clear, concise comment.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'postComment' }))

    expect(
      await screen.findByText('A clear, concise comment.')
    ).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback/10/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'A clear, concise comment.' }),
    })
    expect(commentInput).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'deleteComment' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('A clear, concise comment.')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      '/api/feedback/10/comments/9',
      { method: 'DELETE' }
    )

    fireEvent.click(screen.getByRole('button', { name: 'deleteComment' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'deleteCommentConfirm' })
    )

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback/10/comments/9', {
        method: 'DELETE',
      })
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(
      screen.queryByText('A clear, concise comment.')
    ).not.toBeInTheDocument()
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

  it('creates a trimmed feature and reloads the active list', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    fireEvent.click(screen.getByRole('button', { name: 'sortDate' }))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'done' },
    })
    const title = screen.getByPlaceholderText('placeholderTitleFeature')
    const description = screen.getByPlaceholderText(
      'placeholderDescriptionFeature'
    )
    fireEvent.change(title, { target: { value: '  Better practice  ' } })
    fireEvent.change(description, {
      target: { value: '  Add a short daily exercise.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature',
          title: 'Better practice',
          description: 'Add a short daily exercise.',
        }),
      })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'submit' })
      ).not.toBeInTheDocument()
    )
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/feedback?type=feature&sort=date&order=desc&skip=0&limit=10&status=done'
      )
    )
  })

  it('creates a bug with the bug type in its request', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tabBugs' }))
    fireEvent.click(await screen.findByRole('button', { name: 'newBug' }))
    fireEvent.change(screen.getByPlaceholderText('placeholderTitleBug'), {
      target: { value: 'Audio controls freeze' },
    })
    fireEvent.change(screen.getByPlaceholderText('placeholderDescriptionBug'), {
      target: { value: 'Playback stops after changing speed.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bug',
          title: 'Audio controls freeze',
          description: 'Playback stops after changing speed.',
        }),
      })
    )
  })

  it('keeps a rejected submission open with an error and permits retry', async () => {
    let submissionCount = 0
    mockApiFetch.mockImplementation(
      (_url: string, options?: { method?: string }) => {
        if (options?.method === 'POST') {
          submissionCount += 1
          return Promise.resolve(
            submissionCount === 1
              ? new Response(null, { status: 503 })
              : jsonResponse({})
          )
        }
        return Promise.resolve(listResponse())
      }
    )
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    fireEvent.change(screen.getByPlaceholderText('placeholderTitleFeature'), {
      target: { value: 'Keep this title' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('placeholderDescriptionFeature'),
      {
        target: { value: 'Keep this description' },
      }
    )

    fireEvent.click(screen.getByRole('button', { name: 'submit' }))
    expect(await screen.findByText(/errorSubmit/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('placeholderTitleFeature')).toHaveValue(
      'Keep this title'
    )
    expect(
      screen.getByPlaceholderText('placeholderDescriptionFeature')
    ).toHaveValue('Keep this description')

    fireEvent.click(screen.getByRole('button', { name: 'submit' }))
    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.filter(
          ([, options]) => options?.method === 'POST'
        )
      ).toHaveLength(2)
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'submit' })
      ).not.toBeInTheDocument()
    )
  })

  it('requires both fields and preserves the input length limits', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))

    const title = screen.getByPlaceholderText('placeholderTitleFeature')
    const description = screen.getByPlaceholderText(
      'placeholderDescriptionFeature'
    )
    expect(title).toBeRequired()
    expect(title).toHaveAttribute('maxLength', '200')
    expect(description).toBeRequired()
    expect(description).toHaveAttribute('maxLength', '5000')
  })

  it('uses a localized native backdrop beside the non-interactive form panel', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))

    const backdrop = screen.getByRole('button', { name: 'close' })
    const panel = screen.getByText('modalCreateTitleFeature').parentElement!
      .parentElement!.parentElement!
    const overlay = panel.parentElement!
    expect(backdrop.tagName).toBe('BUTTON')
    expect(backdrop).toHaveAttribute('type', 'button')
    expect(backdrop).toHaveAttribute('tabindex', '-1')
    expect(backdrop.parentElement).toBe(overlay)
    expect(backdrop.nextElementSibling).toBe(panel)
    expect(backdrop).toHaveClass('absolute', 'inset-0')
    expect(panel).toHaveClass('relative')
    expect(panel).not.toHaveAttribute('role')
    expect(overlay).not.toHaveAttribute('role')
    expect(panel.closest('button, [role="button"]')).toBeNull()
    expect(screen.getByPlaceholderText('placeholderTitleFeature')).toHaveFocus()
  })

  it('dismisses once on a pointer click outside without submitting', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    const backdrop = screen.getByRole('button', { name: 'close' })
    const overlay = backdrop.parentElement!
    const removals: Node[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records) removals.push(...record.removedNodes)
    })
    observer.observe(overlay.parentElement!, { childList: true })
    try {
      fireEvent.pointerDown(backdrop)
      fireEvent.pointerUp(backdrop)
      fireEvent.click(backdrop)
      await waitFor(() =>
        expect(removals.filter((node) => node === overlay)).toHaveLength(1)
      )
      expect(
        screen.queryByPlaceholderText('placeholderTitleFeature')
      ).toBeNull()
      expect(mockApiFetch).not.toHaveBeenCalledWith(
        '/api/feedback',
        expect.objectContaining({ method: 'POST' })
      )
    } finally {
      observer.disconnect()
    }
  })

  it('keeps panel and field interactions open but dismisses on Escape from a field', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    const title = screen.getByPlaceholderText('placeholderTitleFeature')
    fireEvent.click(screen.getByText('modalCreateTitleFeature'))
    fireEvent.click(title)
    fireEvent.change(title, { target: { value: 'Keep editing' } })
    fireEvent.click(
      screen.getByPlaceholderText('placeholderDescriptionFeature')
    )
    expect(title).toHaveValue('Keep editing')
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument()
    fireEvent.keyDown(title, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('placeholderTitleFeature')).toBeNull()
  })

  it('closes by cancel, Escape, or backdrop and starts reopened forms empty', async () => {
    mockApiFetch.mockResolvedValue(listResponse())
    render(<FeedbackPage />)
    expect(await screen.findByText('Add focused practice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    fireEvent.change(screen.getByPlaceholderText('placeholderTitleFeature'), {
      target: { value: 'Discard this draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(
      screen.queryByPlaceholderText('placeholderTitleFeature')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    expect(screen.getByPlaceholderText('placeholderTitleFeature')).toHaveValue(
      ''
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.queryByPlaceholderText('placeholderTitleFeature')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'newFeature' }))
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(
      screen.queryByPlaceholderText('placeholderTitleFeature')
    ).not.toBeInTheDocument()
  })
})
