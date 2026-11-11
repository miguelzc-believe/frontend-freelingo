import { beforeEach, describe, expect, it, vi } from 'vitest'

type MiddlewareContext = {
  request: Request
  next: () => Promise<{ response: Response }>
}
type ServerMiddleware = (context: MiddlewareContext) => Promise<Response>
type HandlerContext = { handlerType: string }

const mocks = vi.hoisted(() => ({
  middleware: undefined as ServerMiddleware | undefined,
  csrfFilter: undefined as ((context: HandlerContext) => boolean) | undefined,
}))

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (handler: ServerMiddleware) => {
      mocks.middleware = handler
      return handler
    },
  }),
  createCsrfMiddleware: ({
    filter,
  }: {
    filter: (context: HandlerContext) => boolean
  }) => {
    mocks.csrfFilter = filter
    return { filter }
  },
  createStart: (factory: () => unknown) => factory(),
}))

beforeEach(async () => {
  mocks.middleware = undefined
  mocks.csrfFilter = undefined
  vi.resetModules()
  await import('@/start')
})

async function runMiddleware(
  url: string,
  headers: HeadersInit = {},
  nextResponse = new Response('ok', { headers: { 'x-upstream': 'present' } })
) {
  const middleware = mocks.middleware
  if (!middleware) throw new Error('presentation middleware was not registered')
  return middleware({
    request: new Request(`http://localhost${url}`, { headers }),
    next: async () => ({ response: nextResponse }),
  })
}

describe('Start server middleware', () => {
  it('registers CSRF middleware only for server functions', () => {
    expect(mocks.csrfFilter?.({ handlerType: 'serverFn' })).toBe(true)
    expect(mocks.csrfFilter?.({ handlerType: 'route' })).toBe(false)
  })

  it('redirects unauthenticated protected requests and still applies security headers', async () => {
    const response = await runMiddleware('/dashboard')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/login')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('set-cookie')).toContain('NEXT_LOCALE=en')
  })

  it('continues authenticated requests, preserves upstream headers and uses the locale cookie', async () => {
    const response = await runMiddleware(
      '/dashboard',
      { cookie: 'refresh_token=token; NEXT_LOCALE=es' },
      new Response('private page', { headers: { 'x-upstream': 'preserved' } })
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('private page')
    expect(response.headers.get('x-upstream')).toBe('preserved')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('adds the production CSP and Secure locale cookie only when required', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = await runMiddleware('/public', {
      'accept-language': 'es-MX,es;q=0.9,en;q=0.5',
    })
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'"
    )
    expect(response.headers.get('set-cookie')).toContain('NEXT_LOCALE=es')
    expect(response.headers.get('set-cookie')).toContain('Secure')
  })
})
