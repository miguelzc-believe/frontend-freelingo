import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/lib/navigation')

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidate: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  preloadRoute: vi.fn(),
  params: vi.fn(),
  notFound: vi.fn(),
  location: { pathname: '/lesson/1', searchStr: '?lang=ja&x=1' },
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mocks.navigate,
    invalidate: mocks.invalidate,
    history: { back: mocks.back, forward: mocks.forward },
    preloadRoute: mocks.preloadRoute,
  }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: typeof mocks.location }) => unknown
  }) => select({ location: mocks.location }),
  useParams: mocks.params,
  notFound: mocks.notFound,
}))

import {
  notFound,
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from '@/lib/navigation'

describe('navigation adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.location = { pathname: '/lesson/1', searchStr: '?lang=ja&x=1' }
  })

  it('passes complete URLs to navigation and exposes history and invalidation', () => {
    const { result } = renderHook(() => useRouter())
    result.current.push('/chat?language=ja')
    result.current.replace('/plan?day=2')
    result.current.refresh()
    result.current.back()
    result.current.forward()
    result.current.prefetch('/lesson/3?x=1')
    expect(mocks.navigate).toHaveBeenNthCalledWith(1, {
      href: '/chat?language=ja',
    })
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, {
      href: '/plan?day=2',
      replace: true,
    })
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(mocks.back).toHaveBeenCalledOnce()
    expect(mocks.forward).toHaveBeenCalledOnce()
    expect(mocks.preloadRoute).toHaveBeenCalledWith({
      to: '/',
      href: '/lesson/3?x=1',
    })
  })

  it('selects pathname and parses search parameters when location changes', () => {
    const { result, rerender } = renderHook(() => ({
      pathname: usePathname(),
      search: useSearchParams(),
    }))
    expect(result.current.pathname).toBe('/lesson/1')
    expect(result.current.search.get('lang')).toBe('ja')
    const previous = result.current.search
    rerender()
    expect(result.current.search).toBe(previous)
    mocks.location = { pathname: '/chat', searchStr: '?lang=de' }
    rerender()
    expect(result.current.pathname).toBe('/chat')
    expect(result.current.search.get('lang')).toBe('de')
    expect(result.current.search).not.toBe(previous)
  })

  it('returns non-strict route params and throws the router not-found value', () => {
    mocks.params.mockReturnValue({ id: '42' })
    const { result } = renderHook(() => useParams())
    expect(result.current).toEqual({ id: '42' })
    expect(mocks.params).toHaveBeenCalledWith({ strict: false })
    const error = new Error('not found')
    mocks.notFound.mockReturnValue(error)
    expect(() => notFound()).toThrow(error)
  })
})
