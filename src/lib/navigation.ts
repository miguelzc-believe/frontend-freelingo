import { useMemo } from 'react'
import {
  useRouter as useTanStackRouter,
  useRouterState,
  useParams as useRouteParams,
  notFound as routeNotFound,
} from '@tanstack/react-router'

/** Domain navigation uses fully built URLs, including existing query strings. */
export function useRouter() {
  const router = useTanStackRouter()
  return useMemo(
    () => ({
      push: (href: string) => router.navigate({ href }),
      replace: (href: string) => router.navigate({ href, replace: true }),
      refresh: () => router.invalidate(),
      back: () => router.history.back(),
      forward: () => router.history.forward(),
      prefetch: (href: string) => router.preloadRoute({ to: '/', href }),
    }),
    [router]
  )
}
export function usePathname() {
  return useRouterState({ select: (state) => state.location.pathname })
}
export function useSearchParams() {
  const search = useRouterState({ select: (state) => state.location.searchStr })
  return useMemo(() => new URLSearchParams(search), [search])
}
export function useParams() {
  return useRouteParams({ strict: false })
}
export function notFound(): never {
  throw routeNotFound()
}
