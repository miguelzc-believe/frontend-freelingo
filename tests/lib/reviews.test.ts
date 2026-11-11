import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))

import {
  createReview,
  deleteMyReview,
  deleteReview,
  fetchAdminReviews,
  fetchMyReview,
  fetchPublicReviews,
  updateMyReview,
  updateReviewApproval,
} from '@/lib/reviews'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('reviews API client', () => {
  beforeEach(() => mockApiFetch.mockReset())

  it('fetches current user review state', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ has_review: false, review: null })
    )
    await expect(fetchMyReview()).resolves.toEqual({
      has_review: false,
      review: null,
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/reviews/me')
  })

  it('creates a review', async () => {
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ id: 1, rating: 5 }))
    await createReview({ rating: 5, comment: 'Nice' })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: 'Nice' }),
    })
  })

  it('updates and deletes the current user review', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ id: 1, rating: 4 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await updateMyReview({ rating: 4, comment: 'Updated' })
    await deleteMyReview()
    expect(mockApiFetch).toHaveBeenNthCalledWith(1, '/api/reviews/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4, comment: 'Updated' }),
    })
    expect(mockApiFetch).toHaveBeenNthCalledWith(2, '/api/reviews/me', {
      method: 'DELETE',
    })
  })

  it('fetches public reviews with a limit', async () => {
    mockApiFetch.mockResolvedValueOnce(jsonResponse([]))
    await fetchPublicReviews(3)
    expect(mockApiFetch).toHaveBeenCalledWith('/api/reviews/public?limit=3')
  })

  it('fetches admin reviews with filters', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, skip: 0, limit: 20 })
    )
    await fetchAdminReviews({
      isApproved: true,
      rating: 5,
      targetLanguage: 'es-ES',
    })
    expect(mockApiFetch.mock.calls[0]![0]).toContain('/api/admin/reviews?')
    expect(mockApiFetch.mock.calls[0]![0]).toContain('is_approved=true')
    expect(mockApiFetch.mock.calls[0]![0]).toContain('rating=5')
    expect(mockApiFetch.mock.calls[0]![0]).toContain('target_language=es-ES')
  })

  it('updates approval and deletes reviews', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ id: 2 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await updateReviewApproval(2, true)
    await deleteReview(2)
    expect(mockApiFetch).toHaveBeenNthCalledWith(1, '/api/admin/reviews/2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_approved: true }),
    })
    expect(mockApiFetch).toHaveBeenNthCalledWith(2, '/api/admin/reviews/2', {
      method: 'DELETE',
    })
  })

  it('uses default pagination and public limits, and respects explicitly false filters', async () => {
    mockApiFetch.mockImplementation(() => Promise.resolve(jsonResponse([])))
    await fetchPublicReviews()
    await fetchAdminReviews()
    await fetchAdminReviews({
      isApproved: false,
      rating: 0,
      targetLanguage: '',
      order: 'asc',
      skip: 5,
      limit: 2,
    })
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/reviews/public?limit=100'
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/reviews?order=desc&skip=0&limit=10'
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/reviews?order=asc&skip=5&limit=2&is_approved=false&rating=0'
    )
  })

  it.each([
    ['read', () => fetchMyReview()],
    ['create', () => createReview({ rating: 3 })],
    ['update', () => updateMyReview({ rating: 3 })],
    ['delete own', () => deleteMyReview()],
    ['public', () => fetchPublicReviews()],
    ['admin', () => fetchAdminReviews()],
    ['approve', () => updateReviewApproval(7, false)],
    ['delete admin', () => deleteReview(7)],
  ])('surfaces HTTP errors for %s', async (_name, call) => {
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}, 403))
    await expect(call()).rejects.toThrow('reviews_api_error_403')
  })
})
