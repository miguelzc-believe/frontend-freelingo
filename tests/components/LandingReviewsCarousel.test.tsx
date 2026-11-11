import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LandingReviewsCarousel } from '@/components/reviews/LandingReviewsCarousel'

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations:
    (namespace?: string) =>
    (key: string, values?: Record<string, string | number>) => {
      if (namespace === 'targetLanguages') {
        const languageNames: Record<string, string> = {
          es: 'Spanish',
          fr: 'French',
        }
        return languageNames[key] ?? key
      }
      if (key === 'learningLanguage') return `Learning ${values?.language}`
      if (key === 'starsLabel') return `${values?.rating} out of 5 stars`
      if (key === 'ratingOnly') return 'Verified FreeLingo rating.'
      return key
    },
}))

describe('LandingReviewsCarousel', () => {
  it('renders reviews with comments', () => {
    render(
      <LandingReviewsCarousel
        reviews={[
          {
            id: 1,
            user_display_name: 'Ada',
            target_language: 'es-ES',
            rating: 5,
            comment: 'Excellent practice',
            created_at: '2026-06-19',
          },
        ]}
      />
    )
    expect(screen.getByText('Ada')).toBeDefined()
    expect(screen.getByText('Excellent practice')).toBeDefined()
    expect(screen.getByText('Learning Spanish')).toBeDefined()
  })

  it('renders rating-only reviews with fallback text', () => {
    render(
      <LandingReviewsCarousel
        reviews={[
          {
            id: 1,
            user_display_name: 'Sam',
            target_language: 'fr-FR',
            rating: 4,
            comment: null,
            created_at: '2026-06-19',
          },
        ]}
      />
    )
    expect(screen.getByText('Verified FreeLingo rating.')).toBeDefined()
  })

  it('renders nothing for empty review list', () => {
    const { container } = render(<LandingReviewsCarousel reviews={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('scrolls multiple reviews forward and wraps to the start at the end', () => {
    vi.useFakeTimers()
    try {
      const reviews = [
        {
          id: 1,
          user_display_name: 'Ada',
          target_language: 'xx',
          rating: 3,
          comment: 'Good',
          created_at: '2026-06-19',
        },
        {
          id: 2,
          user_display_name: 'Sam',
          target_language: 'fr-FR',
          rating: 5,
          comment: null,
          created_at: '2026-06-19',
        },
      ]
      const view = render(<LandingReviewsCarousel reviews={reviews} />)
      expect(screen.getByText('Learning xx')).toBeInTheDocument()
      const scroller = screen
        .getByText('Ada')
        .closest('article')!.parentElement!
      const scrollTo = vi.fn()
      Object.defineProperties(scroller, {
        scrollTo: { value: scrollTo },
        scrollWidth: { value: 1000 },
        clientWidth: { value: 300 },
        scrollLeft: { configurable: true, writable: true, value: 0 },
      })
      act(() => vi.advanceTimersByTime(3500))
      expect(scrollTo).toHaveBeenLastCalledWith({
        left: 320,
        behavior: 'smooth',
      })
      scroller.scrollLeft = 699
      act(() => vi.advanceTimersByTime(3500))
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' })
      view.unmount()
      act(() => vi.advanceTimersByTime(3500))
      expect(scrollTo).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
