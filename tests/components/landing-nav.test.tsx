import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const { mockHasActiveLandingSubscription } = vi.hoisted(() => ({
  mockHasActiveLandingSubscription: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('@/components/ui/app-image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement('img', props),
}))

vi.mock('@/lib/landing-subscription', () => ({
  hasActiveLandingSubscription: mockHasActiveLandingSubscription,
}))

import { LandingNav } from '@/components/ui/landing-nav'

function renderNav(
  overrides: Partial<React.ComponentProps<typeof LandingNav>> = {}
) {
  return render(
    <LandingNav
      hasSession={false}
      stripeEnabled
      navFeatures="Features"
      navReviews="Reviews"
      navPricing="Pricing"
      navFAQ="FAQ"
      showReviews
      signIn="Sign in"
      dashboard="Dashboard"
      {...overrides}
    />
  )
}

beforeEach(() => mockHasActiveLandingSubscription.mockReset())
afterEach(() => vi.restoreAllMocks())

describe('LandingNav', () => {
  it('shows public pricing and hides reviews when configured off', () => {
    renderNav({ showReviews: false })

    expect(screen.getAllByRole('link', { name: 'Pricing' })).toHaveLength(1)
    expect(
      screen.queryByRole('link', { name: 'Reviews' })
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(1)
    expect(mockHasActiveLandingSubscription).not.toHaveBeenCalled()
  })

  it('shows pricing only for subscribed status and routes signed-in users to dashboard', async () => {
    mockHasActiveLandingSubscription.mockResolvedValueOnce(true)
    renderNav({ hasSession: true })

    expect(
      await screen.findByRole('link', { name: 'Dashboard' })
    ).toHaveAttribute('href', '/dashboard')
    expect(
      screen.queryByRole('link', { name: 'Pricing' })
    ).not.toBeInTheDocument()
    expect(mockHasActiveLandingSubscription).toHaveBeenCalledTimes(1)
  })

  it('shows pricing to signed-in users without an active landing subscription', async () => {
    mockHasActiveLandingSubscription.mockResolvedValueOnce(false)
    renderNav({ hasSession: true })

    expect(
      await screen.findByRole('link', { name: 'Pricing' })
    ).toBeInTheDocument()
  })

  it('omits pricing when Stripe is disabled and closes the mobile menu on link selection', () => {
    renderNav({ stripeEnabled: false })

    expect(
      screen.queryByRole('link', { name: 'Pricing' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }))
    const featureLinks = screen.getAllByRole('link', { name: 'Features' })
    fireEvent.click(featureLinks.at(-1) as HTMLAnchorElement)
    expect(screen.getByRole('button', { name: 'openMenu' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'closeMenu' })
    ).not.toBeInTheDocument()
  })

  it.each(['Reviews', 'Pricing', 'FAQ', 'Sign in'])(
    'closes the mobile menu when choosing %s',
    (name) => {
      renderNav()
      fireEvent.click(screen.getByRole('button', { name: 'openMenu' }))
      const links = screen.getAllByRole('link', { name })
      expect(links).toHaveLength(2)
      fireEvent.click(links[1]!)
      expect(
        screen.getByRole('button', { name: 'openMenu' })
      ).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name })).toHaveLength(1)
    }
  )

  it('ignores a subscription check that resolves after the session ends', async () => {
    let resolve!: (subscribed: boolean) => void
    mockHasActiveLandingSubscription.mockReturnValueOnce(
      new Promise<boolean>((done) => {
        resolve = done
      })
    )
    const view = renderNav({ hasSession: true })
    view.rerender(
      <LandingNav
        hasSession={false}
        stripeEnabled
        navFeatures="Features"
        navReviews="Reviews"
        navPricing="Pricing"
        navFAQ="FAQ"
        showReviews
        signIn="Sign in"
        dashboard="Dashboard"
      />
    )
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
    await act(async () => resolve(true))
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login'
    )
  })
})
