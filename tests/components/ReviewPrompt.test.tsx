import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  ReviewPrompt,
  getReviewPromptDismissal,
} from '@/components/reviews/ReviewPrompt'

const { mockCreateReview, mockFetchMyReview } = vi.hoisted(() => ({
  mockCreateReview: vi.fn(),
  mockFetchMyReview: vi.fn(),
}))

vi.mock('@/lib/reviews', () => ({
  createReview: mockCreateReview,
  fetchMyReview: mockFetchMyReview,
}))

const translations: Record<string, string> = {
  cancel: 'Cancel',
  commentLabel: 'Comment optional',
  ratingLabel: 'Rating required',
  ratingRequiredError: 'Please choose a rating before submitting.',
  star: 'star',
  stars: 'stars',
  submit: 'Submit',
}

const translate = (key: string, values?: { rating: number }) =>
  key === 'starsLabel'
    ? `${values?.rating} out of 5 stars`
    : (translations[key] ?? key)

vi.mock('use-intl', () => ({
  useTranslations: () => translate,
}))

describe('ReviewPrompt', () => {
  beforeEach(() => {
    mockCreateReview.mockReset()
    mockFetchMyReview
      .mockReset()
      .mockResolvedValue({ has_review: false, review: null })
    window.localStorage.clear()
  })

  it('does not submit without rating', async () => {
    render(<ReviewPrompt open onClose={() => {}} />)
    await screen.findByText('Rating required')
    fireEvent.click(screen.getByText('Submit'))
    expect(mockCreateReview).not.toHaveBeenCalled()
    expect(
      screen.getByText('Please choose a rating before submitting.')
    ).toBeDefined()
  })

  it('submits rating-only reviews', async () => {
    const onClose = vi.fn()
    mockCreateReview.mockResolvedValue({ id: 1, rating: 5 })
    let resolveReview!: (value: { has_review: boolean; review: null }) => void
    mockFetchMyReview.mockReturnValueOnce(
      new Promise<{ has_review: boolean; review: null }>((resolve) => {
        resolveReview = resolve
      })
    )
    render(<ReviewPrompt open onClose={onClose} />)
    expect(screen.getByText('checking')).toBeInTheDocument()
    expect(screen.queryByText('Rating required')).toBeNull()
    await act(async () => {
      resolveReview({ has_review: false, review: null })
    })
    await screen.findByText('Rating required')
    fireEvent.click(screen.getByLabelText('5 out of 5 stars'))
    await waitFor(() =>
      expect(screen.getByLabelText('5 out of 5 stars')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    )
    fireEvent.click(screen.getByText('Submit'))
    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith({
        rating: 5,
        comment: undefined,
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('submits rating plus comment', async () => {
    mockCreateReview.mockResolvedValue({ id: 1, rating: 4 })
    let resolveReview!: (value: { has_review: boolean; review: null }) => void
    mockFetchMyReview.mockReturnValueOnce(
      new Promise<{ has_review: boolean; review: null }>((resolve) => {
        resolveReview = resolve
      })
    )
    render(<ReviewPrompt open onClose={() => {}} />)
    await act(async () => {
      resolveReview({ has_review: false, review: null })
    })
    await screen.findByText('Rating required')
    fireEvent.click(screen.getByLabelText('4 out of 5 stars'))
    await waitFor(() =>
      expect(screen.getByLabelText('4 out of 5 stars')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    )
    fireEvent.change(screen.getByLabelText('Comment optional'), {
      target: { value: 'Helpful app' },
    })
    await waitFor(() =>
      expect(screen.getByLabelText('Comment optional')).toHaveValue(
        'Helpful app'
      )
    )
    fireEvent.click(screen.getByText('Submit'))
    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith({
        rating: 4,
        comment: 'Helpful app',
      })
    )
  })

  it('preserves the review form node, focus and draft while submission is pending', async () => {
    let resolveCreate!: (review: { id: number; rating: number }) => void
    mockCreateReview.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve
      })
    )
    const onClose = vi.fn()
    const { rerender } = render(<ReviewPrompt open onClose={onClose} />)
    await screen.findByText('Rating required')
    const comment = screen.getByLabelText('Comment optional')
    const rating = screen.getByLabelText('4 out of 5 stars')
    fireEvent.click(rating)
    fireEvent.change(comment, { target: { value: 'My draft' } })
    comment.focus()
    fireEvent.click(screen.getByText('Submit'))
    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith({
        rating: 4,
        comment: 'My draft',
      })
    )

    rerender(<ReviewPrompt open onClose={onClose} />)

    expect(screen.getByLabelText('Comment optional')).toBe(comment)
    expect(comment).toHaveValue('My draft')
    expect(comment).toHaveFocus()
    expect(rating).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Submit')).toBeDisabled()
    await act(async () => resolveCreate({ id: 1, rating: 4 }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cancel stores dismissal and does not call backend create', async () => {
    const onClose = vi.fn()
    render(<ReviewPrompt open onClose={onClose} />)
    await screen.findByText('Rating required')
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockCreateReview).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(getReviewPromptDismissal().count).toBe(1)
  })

  it('does not render prompt when user already has review', async () => {
    mockFetchMyReview.mockResolvedValue({ has_review: true, review: { id: 1 } })
    render(<ReviewPrompt open onClose={() => {}} />)
    await waitFor(() =>
      expect(screen.queryByText('Rating required')).toBeNull()
    )
  })

  it('does not submit when review status check fails', async () => {
    mockFetchMyReview.mockRejectedValue(new Error('network error'))
    render(<ReviewPrompt open onClose={() => {}} />)
    await screen.findByText('statusError')
    expect(screen.queryByText('Submit')).toBeNull()
    expect(mockCreateReview).not.toHaveBeenCalled()
  })

  it('treats corrupt dismissal data as an empty history', () => {
    window.localStorage.setItem('freelingo:reviewPromptDismissed', '{bad json')
    expect(getReviewPromptDismissal()).toEqual({ count: 0, lastDismissedAt: 0 })
  })

  it('normalizes missing and nonnumeric dismissal fields', () => {
    window.localStorage.setItem(
      'freelingo:reviewPromptDismissed',
      JSON.stringify({ count: 'invalid' })
    )
    expect(getReviewPromptDismissal()).toEqual({ count: 0, lastDismissedAt: 0 })
  })

  it.each(['success', 'failure'] as const)(
    'ignores a status check that completes after the prompt closes: %s',
    async (outcome) => {
      let resolve!: (value: { has_review: boolean; review: null }) => void
      let reject!: (error: Error) => void
      mockFetchMyReview.mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done
          reject = fail
        })
      )
      const props = { onClose: vi.fn() }
      const view = render(<ReviewPrompt open {...props} />)
      expect(screen.getByText('checking')).toBeInTheDocument()
      view.rerender(<ReviewPrompt open={false} {...props} />)
      await act(async () => {
        if (outcome === 'success') resolve({ has_review: true, review: null })
        else reject(new Error('offline'))
      })
      expect(view.container).toBeEmptyDOMElement()
      mockFetchMyReview.mockResolvedValueOnce({
        has_review: false,
        review: null,
      })
      view.rerender(<ReviewPrompt open {...props} />)
      expect(await screen.findByText('Rating required')).toBeInTheDocument()
      expect(screen.queryByText('statusError')).not.toBeInTheDocument()
    }
  )

  it('keeps the review form open with its draft after a save failure', async () => {
    mockCreateReview.mockRejectedValueOnce(new Error('offline'))
    const onClose = vi.fn()
    render(<ReviewPrompt open onClose={onClose} />)
    await screen.findByText('Rating required')
    fireEvent.click(screen.getByLabelText('4 out of 5 stars'))
    fireEvent.change(screen.getByLabelText('Comment optional'), {
      target: { value: 'Helpful' },
    })
    fireEvent.click(screen.getByText('Submit'))
    expect(await screen.findByText('saveError')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment optional')).toHaveValue('Helpful')
    expect(screen.getByText('Submit')).toBeEnabled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
