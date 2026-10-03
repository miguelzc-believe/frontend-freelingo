import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
    stringifySearch: (search) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(search)) {
        if (value == null) continue
        if (typeof value === 'string') params.set(key, value)
        else if (typeof value === 'number' || typeof value === 'boolean')
          params.set(key, value.toString())
        else throw new Error('Unsupported search parameter type')
      }
      return params.size ? `?${params}` : ''
    },
    scrollRestoration: true,
    trailingSlash: 'never',
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
