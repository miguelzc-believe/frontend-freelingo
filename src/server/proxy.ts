const hopByHop = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]

/** Fixed upstream only: a client cannot supply a proxy destination. */
export async function proxyBackend(
  request: Request,
  backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(backendUrl)
  target.pathname = incoming.pathname
  target.search = incoming.search
  const headers = new Headers(request.headers)
  for (const name of hopByHop) headers.delete(name)
  // Decompression by fetch changes the wire representation.
  headers.set('accept-encoding', 'identity')
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    signal: request.signal,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body
    init.duplex = 'half'
  }
  try {
    const upstream = await fetch(target, init)
    const responseHeaders = new Headers(upstream.headers)
    for (const name of [...hopByHop, 'content-encoding'])
      responseHeaders.delete(name)
    responseHeaders.delete('set-cookie')
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append('set-cookie', cookie)
    if (responseHeaders.get('content-type')?.includes('text/event-stream')) {
      responseHeaders.set('cache-control', 'no-cache, no-transform')
      responseHeaders.set('x-accel-buffering', 'no')
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    if (request.signal.aborted) throw error
    return Response.json({ detail: 'Backend unavailable' }, { status: 502 })
  }
}
