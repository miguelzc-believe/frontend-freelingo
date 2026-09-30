export async function proxyAnalytics(request: Request): Promise<Response> {
  const scriptUrl = process.env.UMAMI_SCRIPT_URL
  if (!scriptUrl) return new Response('Umami not configured', { status: 404 })
  const incoming = new URL(request.url)
  const script = new URL(scriptUrl)
  const isScript = incoming.pathname === '/umami/script.js'
  const target = isScript
    ? script
    : new URL(
        incoming.pathname.replace(/^\/umami/, '') + incoming.search,
        script.origin
      )
  try {
    const init: RequestInit = {
      method: request.method,
      signal: request.signal,
      headers: {
        'content-type':
          request.headers.get('content-type') ?? 'application/json',
        'user-agent': request.headers.get('user-agent') ?? '',
        'accept-language': request.headers.get('accept-language') ?? '*',
      },
    }
    if (request.method === 'POST') init.body = await request.text()
    const response = await fetch(target, init)
    const headers = new Headers()
    if (isScript) {
      headers.set('content-type', 'application/javascript; charset=utf-8')
      headers.set('cache-control', 'public, max-age=3600, s-maxage=3600')
    }
    return new Response(response.body, { status: response.status, headers })
  } catch {
    return new Response(null, { status: 502 })
  }
}
