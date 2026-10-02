import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    render(<ReviewSection />)

    expect(await screen.findByText('reviewPending')).toBeInTheDocument()
    expect(mockFetchMyReview).toHaveBeenCalled()
    expect(screen.getByLabelText('commentLabel')).toHaveValue('Useful lessons')
    expect(screen.getByLabelText('3 out of 5 stars')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    fireEvent.click(screen.getByLabelText('5 out of 5 stars'))
    await waitFor(() =>
      expect(screen.getByLabelText('5 out of 5 stars')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    )
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
})
