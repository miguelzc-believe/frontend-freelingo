import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewSection } from '@/components/settings/ReviewSection'
import type { ReviewAdmin } from '@/types/api'

const {
  mockCreateReview,
  mockDeleteMyReview,
  mockFetchMyReview,
  mockTranslate,
  mockUpdateMyReview,
} = vi.hoisted(() => ({
  mockCreateReview: vi.fn(),
  mockDeleteMyReview: vi.fn(),
  mockFetchMyReview: vi.fn(),
  mockTranslate: (key: string, values?: { rating: number }) =>
    key === 'starsLabel' ? `${values?.rating} out of 5 stars` : key,
  mockUpdateMyReview: vi.fn(),
}))

vi.mock('@/lib/reviews', () => ({
  createReview: mockCreateReview,
  deleteMyReview: mockDeleteMyReview,
  fetchMyReview: mockFetchMyReview,
  updateMyReview: mockUpdateMyReview,
}))

vi.mock('use-intl', () => ({
  useTranslations: () => mockTranslate,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const review: ReviewAdmin = {
  id: 7,
  user_id: 3,
  user_display_name: 'Learner',
  target_language: 'en-GB',
  rating: 3,
  comment: 'Useful lessons',
  is_approved: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('ReviewSection', () => {
  beforeEach(() => {
    mockCreateReview.mockReset()
    mockDeleteMyReview.mockReset().mockResolvedValue(undefined)
    mockFetchMyReview.mockReset().mockResolvedValue({
      has_review: true,
      review,
    })
    mockUpdateMyReview.mockReset().mockResolvedValue(review)
  })

  it('loads an existing pending review and updates its rating and comment', async () => {
    const fetch = deferred<{ has_review: boolean; review: ReviewAdmin }>()
    mockFetchMyReview.mockReturnValueOnce(fetch.promise)
    render(<ReviewSection />)

    await act(async () => {
      fetch.resolve({ has_review: true, review })
      await fetch.promise
    })

    expect(await screen.findByText('reviewPending')).toBeInTheDocument()
    expect(mockFetchMyReview).toHaveBeenCalled()
    expect(screen.getByLabelText('commentLabel')).toHaveValue('Useful lessons')
    expect(screen.getByLabelText('3 out of 5 stars')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    const fiveStarRadio = screen.getByLabelText('5 out of 5 stars')
    fireEvent.click(fiveStarRadio)
    expect(fiveStarRadio).toHaveAttribute('aria-checked', 'true')
    fireEvent.change(screen.getByLabelText('commentLabel'), {
      target: { value: '  Even more useful  ' },
    })
    fireEvent.click(screen.getByText('reviewUpdate'))

    await waitFor(() =>
      expect(mockUpdateMyReview).toHaveBeenCalledWith({
        rating: 5,
        comment: 'Even more useful',
      })
    )
    expect(mockCreateReview).not.toHaveBeenCalled()
    expect(await screen.findByText('reviewSaved')).toBeInTheDocument()
  })

  it('keeps the loaded review form and selected rating through a pending update', async () => {
    const fetch = deferred<{ has_review: boolean; review: ReviewAdmin }>()
    const update = deferred<ReviewAdmin>()
    const updatedReview = { ...review, rating: 5, comment: 'Updated comment' }
    mockFetchMyReview.mockReturnValueOnce(fetch.promise)
    mockUpdateMyReview.mockReturnValueOnce(update.promise)

    render(<ReviewSection />)

    expect(screen.getByText('checking')).toBeInTheDocument()
    expect(screen.queryByLabelText('commentLabel')).not.toBeInTheDocument()
    await act(async () => {
      fetch.resolve({ has_review: true, review })
      await fetch.promise
    })

    expect(await screen.findByText('reviewPending')).toBeInTheDocument()
    expect(screen.getByLabelText('commentLabel')).toHaveValue('Useful lessons')
    expect(screen.getByLabelText('3 out of 5 stars')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    const comment = screen.getByLabelText('commentLabel')
    const fiveStarRadio = screen.getByLabelText('5 out of 5 stars')
    expect(fiveStarRadio.isConnected).toBe(true)
    fireEvent.click(fiveStarRadio)
    expect(fiveStarRadio).toHaveAttribute('aria-checked', 'true')
    fireEvent.change(comment, {
      target: { value: 'Updated comment' },
    })
    comment.focus()
    fireEvent.click(screen.getByText('reviewUpdate'))
    await waitFor(() =>
      expect(mockUpdateMyReview).toHaveBeenCalledWith({
        rating: 5,
        comment: 'Updated comment',
      })
    )
    expect(fiveStarRadio.isConnected).toBe(true)
    expect(screen.getByLabelText('commentLabel')).toBe(comment)
    expect(comment).toHaveFocus()
    expect(screen.getByText('reviewUpdate')).toBeDisabled()

    await act(async () => {
      update.resolve(updatedReview)
      await update.promise
    })

    expect(fiveStarRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('commentLabel')).toHaveValue('Updated comment')
    expect(await screen.findByText('reviewSaved')).toBeInTheDocument()
  })

  it('confirms deletion, hides the existing review controls, and shows deleted state', async () => {
    render(<ReviewSection />)
    await screen.findByText('reviewPending')

    fireEvent.click(screen.getByText('reviewDelete'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('reviewDeleteConfirm'))

    await waitFor(() => expect(mockDeleteMyReview).toHaveBeenCalledOnce())
    expect(await screen.findByText('reviewDeleted')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'reviewDelete' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByText('submit')).toBeInTheDocument()
    expect(mockCreateReview).not.toHaveBeenCalled()
    expect(mockUpdateMyReview).not.toHaveBeenCalled()
  })

  it('creates a new review and resets the success notice', async () => {
    const fetch = deferred<{ has_review: boolean; review: null }>()
    mockFetchMyReview.mockReturnValueOnce(fetch.promise)
    mockCreateReview.mockResolvedValue({ ...review, rating: 4, comment: null })
    render(<ReviewSection title="Your review" />)
    expect(screen.getByText('Your review')).toBeInTheDocument()
    await act(async () => {
      fetch.resolve({ has_review: false, review: null })
      await fetch.promise
    })
    const submit = await screen.findByRole('button', { name: 'submit' })
    fireEvent.click(screen.getByLabelText('4 out of 5 stars'))
    fireEvent.click(submit)
    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith({ rating: 4 })
    )
    expect(await screen.findByText('reviewSaved')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'reviewDelete' })
    ).toBeInTheDocument()
  })

  it('reports a failed initial review status request', async () => {
    mockFetchMyReview.mockRejectedValue(new Error('offline'))
    render(<ReviewSection />)
    expect(await screen.findByText('statusError')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'submit' })
    ).not.toBeInTheDocument()
  })

  it('reports deletion failures after confirmation', async () => {
    mockDeleteMyReview.mockRejectedValue(new Error('offline'))
    render(<ReviewSection />)
    await screen.findByText('reviewPending')
    fireEvent.click(screen.getByRole('button', { name: 'reviewDelete' }))
    fireEvent.click(screen.getByRole('button', { name: 'reviewDeleteConfirm' }))
    expect(await screen.findByText('reviewDeleteError')).toBeInTheDocument()
    expect(mockDeleteMyReview).toHaveBeenCalledOnce()
  })

  it('allows cancelling deletion without making a request', async () => {
    render(<ReviewSection />)
    await screen.findByText('reviewPending')
    fireEvent.click(screen.getByRole('button', { name: 'reviewDelete' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockDeleteMyReview).not.toHaveBeenCalled()
  })
})
