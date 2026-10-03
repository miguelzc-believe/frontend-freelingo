import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  config: { allowRegistration: false, load: vi.fn() },
}))

vi.mock('@/lib/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
}))
vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: typeof mocks.config) => unknown) =>
    selector(mocks.config),
}))
vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/components/ui/app-image', () => ({
  default: (props: {
    src: string
    alt: string
    width: number
    height: number
  }) => <img {...props} />,
}))

import PrivacyPage from '@/app/(legal)/privacy/page'

const invite = 'a+b &/日本?'
const encodedInvite = encodeURIComponent(invite)

const cases = [
  {
    name: 'landing',
    from: 'landing',
    allowRegistration: false,
    backHref: '/',
    backLabel: 'common.back',
    termsHref: '/terms?from=landing',
  },
  {
    name: 'default origin',
    allowRegistration: false,
    backHref: '/',
    backLabel: 'common.back',
    termsHref: '/terms',
  },
  {
    name: 'unknown origin',
    from: 'unknown',
    allowRegistration: true,
    backHref: '/',
    backLabel: 'common.back',
    termsHref: '/terms',
  },
  {
    name: 'settings',
    from: 'settings',
    allowRegistration: false,
    backHref: '/settings',
    backLabel: 'legal.privacy.linkBackSettings',
    termsHref: '/terms?from=settings',
  },
  {
    name: 'register enabled',
    from: 'register',
    allowRegistration: true,
    backHref: '/register',
    backLabel: 'legal.privacy.linkBack',
    termsHref: '/terms?from=register',
  },
  {
    name: 'register disabled',
    from: 'register',
    allowRegistration: false,
    backHref: '/login',
    backLabel: 'auth.register.login',
    termsHref: '/terms?from=register',
  },
  ...[true, false].map((allowRegistration) => ({
    name: `register with invite, registration ${allowRegistration}`,
    from: 'register',
    invite,
    allowRegistration,
    backHref: `/register?invite=${encodedInvite}`,
    backLabel: 'legal.privacy.linkBack',
    termsHref: `/terms?from=register&invite=${encodedInvite}`,
  })),
]

describe('privacy page navigation equivalence', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams()
    mocks.config.allowRegistration = false
    mocks.config.load.mockReset().mockResolvedValue(undefined)
  })

  it.each(cases)(
    'preserves navigation, labels and legal content for $name',
    (testCase) => {
      if (testCase.from) mocks.searchParams.set('from', testCase.from)
      if ('invite' in testCase)
        mocks.searchParams.set('invite', testCase.invite)
      mocks.config.allowRegistration = testCase.allowRegistration

      const { container } = render(<PrivacyPage />)

      expect(
        screen.getByRole('link', { name: testCase.backLabel })
      ).toHaveAttribute('href', testCase.backHref)
      expect(
        screen.getByRole('link', { name: 'legal.privacy.linkTerms' })
      ).toHaveAttribute('href', testCase.termsHref)
      expect(mocks.config.load).toHaveBeenCalledTimes(
        testCase.from === 'register' ? 1 : 0
      )
      expect(screen.getByRole('link', { name: 'FreeLingo' })).toHaveAttribute(
        'href',
        '/'
      )
      expect(screen.getByRole('img', { name: 'FreeLingo' })).toHaveAttribute(
        'src',
        '/logo.png'
      )
      expect(screen.getByText('common.tagline')).toBeInTheDocument()
      expect(screen.getByText('legal.privacy.pageTitle')).toBeInTheDocument()
      expect(screen.getByText('legal.privacy.updated')).toBeInTheDocument()
      expect(container.querySelectorAll('section')).toHaveLength(9)
      expect(screen.getAllByRole('listitem')).toHaveLength(16)
      for (let section = 1; section <= 9; section++) {
        expect(
          screen.getByRole('heading', {
            level: 2,
            name: `legal.privacy.s${section}Title`,
          })
        ).toBeInTheDocument()
        if (section === 2 || section === 3) {
          expect(
            screen.getByText(`legal.privacy.s${section}Intro`)
          ).toBeInTheDocument()
          for (let item = 1; item <= (section === 2 ? 10 : 6); item++) {
            expect(
              screen.getByText(`legal.privacy.s${section}i${item}`)
            ).toBeInTheDocument()
          }
        } else {
          expect(
            screen.getByText(`legal.privacy.s${section}Body`)
          ).toBeInTheDocument()
        }
      }
      expect(screen.getByText('legal.privacy.s3Footer')).toBeInTheDocument()
    }
  )
})
