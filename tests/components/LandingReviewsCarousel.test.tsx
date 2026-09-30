import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
