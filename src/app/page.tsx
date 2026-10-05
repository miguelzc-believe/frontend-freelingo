import Link from '@/components/ui/app-link'
import Image from '@/components/ui/app-image'
import { useTranslations } from 'use-intl'
import type { LandingData } from '@/server/landing'
import {
  BookOpen,
  MessageSquare,
  Mic,
  Headphones,
  Layers,
  TrendingUp,
} from 'lucide-react'
import PricingSection from '@/components/billing/PricingSection'
import { LandingFAQ } from '@/components/ui/landing-faq'
import { LandingNav } from '@/components/ui/landing-nav'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { ContactButton } from '@/components/ui/contact-button'
import { LanguageBubbles } from '@/components/LanguageBubbles'
import { LandingReviewsCarousel } from '@/components/reviews/LandingReviewsCarousel'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FreeLingo',
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  url: 'https://freelingo.app',
  description:
    'Self-hosted AI-powered language learning platform with voice conversation, flashcards, grammar lessons, and a personal AI tutor.',
  author: {
    '@type': 'Person',
    name: 'Arturo Carretero Calvo',
    url: 'https://www.arturocarreterocalvo.com',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

function heroDestination(hasSession: boolean, allowRegistration: boolean) {
  if (hasSession) return '/dashboard'
  if (allowRegistration) return '/register'
  return '/login'
}

export default function Home({ data }: { readonly data: LandingData }) {
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')
  const tBilling = useTranslations('billing')
  const {
    hasSession,
    allowRegistration,
    stripeEnabled,
    trialDays,
    priceMonthly,
    priceYearly,
    totalPriceMonthly,
    totalPriceYearly,
    reviews,
  } = data
  return (
    <div className="bg-fl-bg text-fl-fg flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <LandingNav
        hasSession={hasSession}
        stripeEnabled={stripeEnabled}
        navFeatures={t('navFeatures')}
        navReviews={t('navReviews')}
        navPricing={t('navPricing')}
        navFAQ={t('navFAQ')}
        showReviews={reviews.length > 0}
        signIn={t('signIn')}
        dashboard={t('dashboard')}
      />

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 pt-[10px] pb-12 text-center">
        <div className="mb-1 flex flex-col items-center">
          <div className="mb-0">
            <LanguageBubbles />
          </div>
          <span className="text-fl-label text-fl-muted-2 mb-4 font-mono tracking-widest uppercase">
            {tCommon('tagline')}
          </span>
          <h1 className="text-fl-fg mb-4 max-w-xl font-sans text-3xl leading-tight font-bold tracking-tight md:text-5xl">
            {t('hero')}
          </h1>
          <p className="text-fl-muted-1 mb-8 max-w-lg font-sans text-base leading-relaxed md:text-lg">
            {t('heroSub')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={heroDestination(hasSession, allowRegistration)}
            className="bg-fl-accent text-fl-accent-fg hover:bg-fl-accent/90 px-8 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-colors"
          >
            {hasSession && t('dashboard')}
            {!hasSession && allowRegistration && tCommon('start')}
            {!hasSession && !allowRegistration && t('signIn')}
          </Link>
          <a
            href="#features"
            className="border-fl-border text-fl-muted-1 hover:text-fl-fg hover:border-fl-border-2 border px-8 py-3 font-mono text-xs font-bold tracking-widest uppercase transition-colors"
          >
            {t('howItWorks')} ↓
          </a>
        </div>
      </section>

      <section
        aria-labelledby="lingu-demo-title"
        className="mx-auto w-full max-w-5xl px-6 pb-12"
      >
        <div className="border-fl-border bg-fl-surface mx-auto max-w-xl border">
          <div className="border-fl-border border-b px-5 py-4 sm:px-6">
            <h2
              id="lingu-demo-title"
              className="text-fl-fg font-mono text-base font-bold"
            >
              {t('microDemo.title')}
            </h2>
            <p className="text-fl-caption text-fl-muted-1 mt-1 font-mono">
              {t('microDemo.exampleLabel')}
            </p>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-fl-caption text-fl-muted-1 mb-2 font-mono">
                {t('microDemo.questionLabel')}
              </p>
              <p
                lang="en-GB"
                className="text-fl-fg font-mono text-sm leading-relaxed"
              >
                What did you do yesterday?
              </p>
            </div>
            <div className="border-fl-border border-l-2 pl-4">
              <p className="text-fl-caption text-fl-muted-1 mb-2 font-mono">
                {t('microDemo.answerLabel')}
              </p>
              <p
                lang="en-GB"
                className="text-fl-fg-2 font-mono text-sm leading-relaxed"
              >
                Yesterday I go to the park.
              </p>
            </div>
            <div className="border-fl-accent/40 border-l-2 pl-4">
              <p className="text-fl-caption text-fl-muted-1 mb-2 font-mono">
                {t('microDemo.correctionLabel')}
              </p>
              <p
                lang="en-GB"
                className="text-fl-fg font-mono text-sm leading-relaxed"
              >
                Yesterday I{' '}
                <strong className="font-bold underline underline-offset-4">
                  went
                </strong>{' '}
                to the park.
              </p>
              <p className="text-fl-muted-1 mt-2 font-mono text-sm leading-relaxed">
                {t('microDemo.explanation')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <ScrollReveal>
        <section
          id="features"
          className="mx-auto w-full max-w-5xl scroll-mt-16 px-6 pb-24"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: t('feature1Title'),
                desc: t('feature1Desc'),
                Icon: BookOpen,
              },
              {
                title: t('feature2Title'),
                desc: t('feature2Desc'),
                Icon: MessageSquare,
              },
              { title: t('feature3Title'), desc: t('feature3Desc'), Icon: Mic },
              {
                title: t('feature4Title'),
                desc: t('feature4Desc'),
                Icon: Headphones,
              },
              {
                title: t('feature5Title'),
                desc: t('feature5Desc'),
                Icon: Layers,
              },
              {
                title: t('feature6Title'),
                desc: t('feature6Desc'),
                Icon: TrendingUp,
              },
            ].map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="border-fl-border bg-fl-surface border p-6"
              >
                <div className="border-fl-border mb-4 flex items-center gap-2 border-b pb-3">
                  <Icon className="text-fl-muted-2 h-4 w-4" />
                  <span className="text-fl-label text-fl-muted-2 font-sans text-sm font-semibold tracking-tight">
                    {title}
                  </span>
                </div>
                <p className="text-fl-muted-1 font-mono text-xs leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* Reviews */}
      <ScrollReveal>
        <LandingReviewsCarousel reviews={reviews} />
      </ScrollReveal>

      {/* Pricing */}
      <ScrollReveal>
        <div id="pricing" className="scroll-mt-16">
          <PricingSection
            allowRegistration={allowRegistration}
            stripeEnabled={stripeEnabled}
            trialDays={trialDays}
            hasSession={hasSession}
            priceMonthly={priceMonthly}
            priceYearly={priceYearly}
            totalPriceMonthly={totalPriceMonthly}
            totalPriceYearly={totalPriceYearly}
          />
        </div>
      </ScrollReveal>

      {/* Open Source */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-5xl px-6 pb-16">
          <div className="border-fl-border bg-fl-surface flex flex-col items-center justify-between gap-4 border px-8 py-5 sm:flex-row">
            <div className="flex items-center gap-4">
              <Image
                src="/github.svg"
                alt="GitHub"
                width={20}
                height={20}
                className="block opacity-80 dark:hidden"
              />
              <Image
                src="/github_white.svg"
                alt="GitHub"
                width={20}
                height={20}
                className="hidden opacity-80 dark:block"
              />
              <div className="text-left">
                <p className="text-fl-fg font-sans text-sm font-semibold tracking-tight">
                  {tBilling('openSourceTitle')}
                </p>
                <p className="text-fl-hint text-fl-muted-2 mt-0.5 font-mono tracking-widest uppercase">
                  {tBilling('openSourceDesc')}
                </p>
              </div>
            </div>
            <a
              href="https://github.com/artcc/freelingo"
              target="_blank"
              rel="noopener noreferrer"
              className="border-fl-border text-fl-muted-1 hover:text-fl-fg hover:border-fl-border-2 border px-6 py-2.5 font-mono text-xs font-bold tracking-widest whitespace-nowrap uppercase transition-colors"
            >
              {tBilling('openSourceCta')}
            </a>
          </div>
        </section>
      </ScrollReveal>

      {/* FAQ */}
      <ScrollReveal>
        <section
          id="faq"
          className="mx-auto w-full max-w-5xl scroll-mt-16 px-6 pb-16"
        >
          <h2 className="text-fl-label text-fl-muted-2 mb-8 text-center font-mono tracking-widest uppercase">
            {t('faqTitle')}
          </h2>
          <LandingFAQ />
        </section>
      </ScrollReveal>

      {/* Footer */}
      <footer className="border-fl-border border-t px-6 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <span className="text-fl-hint text-fl-muted-3 font-code block tracking-widest uppercase">
              FreeLingo
            </span>
            <span className="text-fl-hint text-fl-muted-4 mt-2 block font-mono leading-relaxed">
              © {new Date().getFullYear()}
            </span>
          </div>
          <div>
            <h4 className="text-fl-label text-fl-muted-2 mb-3 font-sans text-sm font-semibold tracking-tight">
              {t('footerProduct')}
            </h4>
            <div className="flex flex-col gap-2">
              <a
                href="https://github.com/artcc/freelingo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fl-hint text-fl-muted-3 hover:text-fl-muted-1 font-mono tracking-widest uppercase transition-colors"
              >
                {t('github')}
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-fl-label text-fl-muted-2 mb-3 font-sans text-sm font-semibold tracking-tight">
              {t('footerLegal')}
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/privacy?from=landing"
                className="text-fl-hint text-fl-muted-3 hover:text-fl-muted-1 font-mono tracking-widest uppercase transition-colors"
              >
                {t('privacy')}
              </Link>
              <Link
                href="/terms?from=landing"
                className="text-fl-hint text-fl-muted-3 hover:text-fl-muted-1 font-mono tracking-widest uppercase transition-colors"
              >
                {t('terms')}
              </Link>
            </div>
          </div>
          <div>
            <h4 className="text-fl-label text-fl-muted-2 mb-3 font-sans text-sm font-semibold tracking-tight">
              {t('contact')}
            </h4>
            <div className="flex flex-col gap-2">
              <a
                href="https://www.arturocarreterocalvo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fl-hint text-fl-muted-3 hover:text-fl-muted-1 font-mono tracking-widest uppercase transition-colors"
              >
                {t('aboutMe')}
              </a>
              <ContactButton />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
