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
import AdminReviewsPage from '@/app/(app)/admin/reviews/page'

vi.mock('use-intl', () => {
  const translations = new Map<
    string,
    (key: string, values?: Record<string, string | number>) => string
  >()
  function useTranslations(namespace: string) {
    const existing = translations.get(namespace)
    if (existing) return existing
    const translate = (
      key: string,
      values?: Record<string, string | number>
    ) => {
      if (namespace === 'targetLanguages' && key === 'de-DE') return 'German'
      if (key === 'learningLanguage') return `Learning ${values?.language}`
      if (key === 'starsLabel')
        return namespace === 'landingReviews'
          ? `${values?.rating} out of 5 stars`
          : `${values?.rating} stars`
      if (key === 'total') return `${values?.total} total`
      const labels: Record<string, string> = {
        approve: 'Approve',
        approved: 'Approved',
        cancel: 'Cancel',
        delete: 'Delete',
        pending: 'Pending',
        ratingOnly: 'Rating-only review.',
      }
      return labels[key] ?? key
    }
    translations.set(namespace, translate)
    return translate
  }
  return { useLocale: () => 'en', useTranslations }
})
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', { href: String(href), ...props }, children),
}))
vi.mock('@/lib/navigation', () => ({ usePathname: () => '/admin/reviews' }))

const { mockDeleteReview, mockFetchAdminReviews, mockUpdateReviewApproval } =
  vi.hoisted(() => ({
    mockDeleteReview: vi.fn(),
    mockFetchAdminReviews: vi.fn(),
    mockUpdateReviewApproval: vi.fn(),
  }))

vi.mock('@/lib/reviews', () => ({
  deleteReview: mockDeleteReview,
  fetchAdminReviews: mockFetchAdminReviews,
  updateReviewApproval: mockUpdateReviewApproval,
}))

const review = {
  id: 7,
  user_id: 3,
  user_display_name: 'Reviewer',
  target_language: 'de-DE',
  rating: 5,
  comment: 'Strong experience',
  is_approved: false,
  created_at: '2026-06-19T10:00:00',
  updated_at: '2026-06-19T10:00:00',
}

describe('AdminReviewsPage', () => {
  beforeEach(() => {
    mockDeleteReview.mockReset().mockResolvedValue(undefined)
    mockUpdateReviewApproval
      .mockReset()
      .mockResolvedValue({ ...review, is_approved: true })
    mockFetchAdminReviews
      .mockReset()
      .mockResolvedValue({ items: [review], total: 1, skip: 0, limit: 20 })
  })

  it('renders review list', async () => {
    render(<AdminReviewsPage />)
    expect(await screen.findByText('Reviewer')).toBeDefined()
    expect(screen.getByText('Strong experience')).toBeDefined()
    expect(screen.getByText(/Learning German/)).toBeDefined()
    expect(screen.getByLabelText('5 out of 5 stars')).toBeInTheDocument()
  })

  it('calls approve action', async () => {
    render(<AdminReviewsPage />)
    fireEvent.click(await screen.findByText('Approve'))
    await waitFor(() =>
      expect(mockUpdateReviewApproval).toHaveBeenCalledWith(7, true)
    )
  })

  it('updates the selected review without changing other reviews', async () => {
    const other = {
      ...review,
      id: 8,
      user_display_name: 'Second reviewer',
      comment: 'Another review',
    }
    mockFetchAdminReviews.mockResolvedValue({
      items: [review, other],
      total: 2,
    })
    let resolveApproval!: (value: typeof review) => void
    mockUpdateReviewApproval.mockReturnValueOnce(
      new Promise<typeof review>((resolve) => {
        resolveApproval = resolve
      })
    )
    render(<AdminReviewsPage />)
    const first = (await screen.findByText('Reviewer')).closest('article')!
    expect(screen.getByText('Second reviewer')).toBeInTheDocument()
    fireEvent.click(within(first).getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(mockUpdateReviewApproval).toHaveBeenCalledWith(7, true)
    )
    await act(async () => {
      resolveApproval({ ...review, is_approved: true })
    })
    await waitFor(() =>
      expect(
        within(screen.getByText('Reviewer').closest('article')!).getByRole(
          'button',
          { name: 'unapprove' }
        )
      ).toBeInTheDocument()
    )
    expect(
      within(screen.getByText('Second reviewer').closest('article')!).getByRole(
        'button',
        { name: 'Approve' }
      )
    ).toBeInTheDocument()
  })

  it('returns to page one when changing or clearing review filters', async () => {
    mockFetchAdminReviews.mockResolvedValue({ items: [review], total: 11 })
    render(<AdminReviewsPage />)
    await screen.findByText('Reviewer')
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        skip: 10,
        limit: 10,
      })
    )
    fireEvent.change(screen.getByLabelText('ratingFilter'), {
      target: { value: '5' },
    })
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        rating: 5,
        skip: 0,
        limit: 10,
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        rating: 5,
        skip: 10,
        limit: 10,
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 10,
      })
    )
  })

  it.each([
    ['pending', false, true, 'Approve'],
    ['approved', true, false, 'unapprove'],
  ] as const)(
    'reloads the %s queue after a review changes approval',
    async (filter, approved, next, button) => {
      mockFetchAdminReviews.mockResolvedValue({
        items: [{ ...review, is_approved: approved }],
        total: 1,
      })
      mockUpdateReviewApproval.mockResolvedValue({
        ...review,
        is_approved: next,
      })
      render(<AdminReviewsPage />)
      await screen.findByText('Reviewer')
      fireEvent.change(screen.getByLabelText('approvalFilter'), {
        target: { value: filter },
      })
      await waitFor(() =>
        expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
          isApproved: approved,
          skip: 0,
          limit: 10,
        })
      )
      await screen.findByText('Reviewer')
      const callsBefore = mockFetchAdminReviews.mock.calls.length
      fireEvent.click(await screen.findByRole('button', { name: button }))
      await waitFor(() =>
        expect(mockUpdateReviewApproval).toHaveBeenCalledWith(7, next)
      )
      await waitFor(() =>
        expect(mockFetchAdminReviews.mock.calls.length).toBeGreaterThan(
          callsBefore
        )
      )
    }
  )

  it('reports review loading and update errors', async () => {
    mockFetchAdminReviews.mockRejectedValue(new Error('offline'))
    const view = render(<AdminReviewsPage />)
    expect(await screen.findByText('loadError')).toBeInTheDocument()
    view.unmount()
    mockFetchAdminReviews.mockResolvedValue({ items: [review], total: 1 })
    mockUpdateReviewApproval.mockRejectedValue(new Error('offline'))
    render(<AdminReviewsPage />)
    await screen.findByText('Reviewer')
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(mockUpdateReviewApproval).toHaveBeenCalledWith(7, true)
    )
    await waitFor(() =>
      expect(
        screen.getByText('updateError', { selector: 'div' })
      ).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
  })

  it('preserves the review and reports a failed deletion', async () => {
    mockDeleteReview.mockRejectedValueOnce(new Error('offline'))
    render(<AdminReviewsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete',
      })
    )
    await waitFor(() => expect(mockDeleteReview).toHaveBeenCalledWith(7))
    await waitFor(() =>
      expect(
        screen.getByText('deleteError', { selector: 'div' })
      ).toBeInTheDocument()
    )
    expect(screen.getByText('Strong experience')).toBeInTheDocument()
  })

  it('calls delete after confirmation', async () => {
    render(<AdminReviewsPage />)
    fireEvent.click(await screen.findByText('Delete'))
    const callsBeforeDelete = mockFetchAdminReviews.mock.calls.length
    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!)
    await waitFor(() => expect(mockDeleteReview).toHaveBeenCalledWith(7))
    await waitFor(() =>
      expect(mockFetchAdminReviews.mock.calls.length).toBeGreaterThan(
        callsBeforeDelete
      )
    )
  })

  it('combines approval and rating filters and clears them', async () => {
    render(<AdminReviewsPage />)
    await screen.findByText('Strong experience')
    fireEvent.change(screen.getByLabelText('approvalFilter'), {
      target: { value: 'pending' },
    })
    fireEvent.change(screen.getByLabelText('ratingFilter'), {
      target: { value: '3' },
    })

    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        isApproved: false,
        rating: 3,
        skip: 0,
        limit: 10,
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 10,
      })
    )
  })

  it('renders approved rating-only reviews with an unknown target language', async () => {
    mockFetchAdminReviews.mockResolvedValue({
      items: [
        {
          ...review,
          is_approved: true,
          target_language: 'xx-ZZ',
          rating: 0,
          comment: '',
        },
      ],
      total: 1,
      skip: 0,
      limit: 10,
    })
    render(<AdminReviewsPage />)

    expect(await screen.findByText('Rating-only review.')).toBeInTheDocument()
    expect(screen.getByText(/Learning xx-ZZ/)).toBeInTheDocument()
    expect(screen.getAllByText('Approved')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'unapprove' })
    ).toBeInTheDocument()
  })

  it('returns to the previous page when deleting the final review on a page', async () => {
    mockFetchAdminReviews.mockResolvedValue({
      items: [review],
      total: 11,
      skip: 0,
      limit: 10,
    })
    render(<AdminReviewsPage />)
    await screen.findByText('Strong experience')
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        skip: 10,
        limit: 10,
      })
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDeleteReview).toHaveBeenCalledWith(7))
    await waitFor(() =>
      expect(mockFetchAdminReviews).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 10,
      })
    )
  })
})
