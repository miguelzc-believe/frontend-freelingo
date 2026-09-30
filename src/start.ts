import {
  createStart,
  createMiddleware,
  createCsrfMiddleware,
} from '@tanstack/react-start'
import { detectLocale, readCookie } from '@/server/locale'
import { securityHeaders, contentSecurityPolicy } from '@/server/security'
import { protectedPath } from '@/lib/protected-routes'

const presentation = createMiddleware().server(async ({ request, next }) => {
  const pathname = new URL(request.url).pathname
  const locale = detectLocale(request)
  const result =
    protectedPath(pathname) &&
    readCookie(request, 'refresh_token') === undefined
      ? new Response(null, { status: 307, headers: { location: '/login' } })
      : (await next()).response
  const headers = new Headers(result.headers)
  for (const [key, value] of Object.entries(securityHeaders))
    headers.set(key, value)
  if (process.env.NODE_ENV === 'production')
    headers.set('Content-Security-Policy', contentSecurityPolicy)
  if (readCookie(request, 'NEXT_LOCALE') === undefined)
    headers.append(
      'set-cookie',
      `NEXT_LOCALE=${locale}; Path=/; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    )
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  })
})
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
    presentation,
  ],
}))
