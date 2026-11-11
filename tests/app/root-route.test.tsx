import type { ComponentType, ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runtime: null as null | {
    locale: string
    messages: Record<string, unknown>
    umamiWebsiteId?: string
  },
  getRuntime: vi.fn(),
  invalidate: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (options: object) => ({
    options,
    useLoaderData: () => mocks.runtime,
  }),
  HeadContent: () => <meta name="test-head" content="present" />,
  Scripts: () => <script src="/test.js" />,
  Outlet: () => null,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('@/server/runtime', () => ({ getRuntime: mocks.getRuntime }))
vi.mock('use-intl', () => ({
  IntlProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/CookieBanner', () => ({
  CookieBanner: () => <div>cookie banner</div>,
}))
vi.mock('@/app/not-found', () => ({ default: () => <p>not found</p> }))
vi.mock('@/app/error', () => ({
  default: ({ error, reset }: { error: Error; reset: () => void }) => (
    <button onClick={reset}>{error.message}</button>
  ),
}))

import { Route } from '@/routes/__root'

const options = Route.options as unknown as {
  loader: () => unknown
  head: () => {
    meta: Array<Record<string, unknown>>
    links: Array<Record<string, unknown>>
  }
  shellComponent: ComponentType<{ children: ReactNode }>
  errorComponent: ComponentType<{ error: unknown; reset: () => void }>
}

describe('root route', () => {
  beforeEach(() => {
    mocks.runtime = null
    mocks.getRuntime.mockReset().mockReturnValue({ locale: 'en' })
    mocks.invalidate.mockReset()
    mocks.reset.mockReset()
  })

  it('loads runtime and supplies essential document metadata', () => {
    expect(options.loader()).toEqual({ locale: 'en' })
    const head = options.head()
    expect(head.meta).toContainEqual({ title: 'FreeLingo' })
    expect(head.links).toContainEqual({
      rel: 'manifest',
      href: '/manifest.webmanifest',
    })
  })

  it('renders a fallback shell without runtime and a localized shell with optional analytics', () => {
    const Shell = options.shellComponent
    const fallback = renderToStaticMarkup(
      <Shell>
        <main>fallback</main>
      </Shell>
    )
    expect(fallback).toContain('<html lang="en"')
    expect(fallback).toContain('fallback')
    expect(fallback).not.toContain('cookie banner')

    mocks.runtime = { locale: 'es', messages: {}, umamiWebsiteId: 'site-id' }
    const html = renderToStaticMarkup(
      <Shell>
        <main>app content</main>
      </Shell>
    )
    expect(html).toContain('<html lang="es"')
    expect(html).toContain('app content')
    expect(html).toContain('cookie banner')
    expect(html).toContain('data-website-id="site-id"')
    expect(html).toContain('LOCALE_DETECTED')
    delete mocks.runtime.umamiWebsiteId
    expect(renderToStaticMarkup(<Shell>app</Shell>)).not.toContain(
      'data-website-id'
    )
  })

  it.each([new Error('broken'), 'unknown failure'])(
    'normalizes %s and resets the router boundary',
    (failure) => {
      const ErrorBoundary = options.errorComponent
      render(<ErrorBoundary error={failure} reset={mocks.reset} />)
      fireEvent.click(
        screen.getByRole('button', {
          name: failure instanceof Error ? failure.message : failure,
        })
      )
      expect(mocks.reset).toHaveBeenCalledOnce()
      expect(mocks.invalidate).toHaveBeenCalledOnce()
    }
  )
})
