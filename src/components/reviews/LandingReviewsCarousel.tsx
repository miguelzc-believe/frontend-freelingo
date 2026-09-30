import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { Star } from 'lucide-react'
import { getLanguageByCode } from '@/lib/target-languages'
import type { ReviewPublic } from '@/types/api'

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <div className="flex gap-1" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-fl-muted-4'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export function LandingReviewsCarousel({
  reviews,
}: {
  reviews: ReviewPublic[]
}) {
  const t = useTranslations('landingReviews')
  const tTarget = useTranslations('targetLanguages')
  const locale = useLocale()
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  function languageLabel(code: string) {
    const language = getLanguageByCode(code)
    return language ? tTarget(language.iso639) : code
  }

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || reviews.length <= 1) return
    const interval = window.setInterval(() => {
      const nextLeft = scroller.scrollLeft + 320
      const maxLeft = scroller.scrollWidth - scroller.clientWidth
      const isAtEnd = scroller.scrollLeft >= maxLeft - 1
      scroller.scrollTo({
        left: isAtEnd ? 0 : Math.min(nextLeft, maxLeft),
        behavior: 'smooth',
      })
    }, 3500)
    return () => window.clearInterval(interval)
  }, [reviews.length])

  if (!reviews.length) return null

  const averageRating =
    reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
  const formattedAverage = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(averageRating)

  return (
    <section
      id="reviews"
      className="mx-auto w-full max-w-5xl scroll-mt-16 px-6 pb-24"
      aria-labelledby="reviews-title"
    >
      <div className="mb-8 flex flex-col gap-3 text-center">
        <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
          {t('eyebrow')}
        </span>
        <h2
          id="reviews-title"
          className="text-fl-fg font-sans text-2xl font-bold tracking-tight md:text-4xl"
        >
          {t('title')}
        </h2>
        <p className="text-fl-muted-1 mx-auto max-w-2xl font-mono text-xs leading-relaxed">
          {t('subtitle')}
        </p>
        <div className="border-fl-border bg-fl-surface/60 text-fl-label text-fl-muted-2 mx-auto inline-flex items-center gap-2 border px-3 py-2 font-mono tracking-widest uppercase">
          <Star
            className="size-3.5 fill-yellow-400 text-yellow-400"
            aria-hidden="true"
          />
          <span>
            {t('averageLabel', {
              average: formattedAverage,
              count: reviews.length,
            })}
          </span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className={`scrollbar-thumb-fl-border flex snap-x scrollbar-thin scrollbar-track-transparent gap-4 overflow-x-auto pb-3 ${reviews.length === 1 ? 'justify-center' : ''}`}
      >
        {reviews.map((review) => (
          <article
            key={review.id}
            className="border-fl-border bg-fl-surface flex min-h-52 w-[280px] flex-none snap-start flex-col border p-5 sm:w-[340px]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-fl-fg font-sans text-sm font-semibold tracking-tight">
                  {review.user_display_name}
                </h3>
                <p className="text-fl-hint text-fl-muted-3 mt-1 font-mono tracking-widest uppercase">
                  {t('learningLanguage', {
                    language: languageLabel(review.target_language),
                  })}
                </p>
              </div>
              <Stars
                rating={review.rating}
                label={t('starsLabel', { rating: review.rating })}
              />
            </div>
            <p className="text-fl-muted-1 line-clamp-6 font-mono text-xs leading-relaxed">
              {review.comment || t('ratingOnly')}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
