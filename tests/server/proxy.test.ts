// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyBackend } from '@/server/proxy'

afterEach(() => vi.unstubAllGlobals())

describe('same-origin transport', () => {
  it('forwards multipart bytes, plan context, cookies and cancellation without changing the boundary', async () => {
    const form = new FormData()
    form.set('study_plan_id', '42')
    form.set('audio', new Blob(['test bytes']), 'sample.wav')
    const request = new Request('http://frontend/api/stt', {
      method: 'POST',
      body: form,
      headers: { authorization: 'Bearer access', cookie: 'refresh_token=test' },
    })
    const backend = vi.fn(async (url: URL, init: RequestInit) => {
      expect(url.href).toBe('http://backend:8000/api/stt')
      expect(init.signal).toBe(request.signal)
      const forwarded = new Request(url, init)
      expect(forwarded.headers.get('authorization')).toBe('Bearer access')
      expect(forwarded.headers.get('cookie')).toBe('refresh_token=test')
      const received = await forwarded.formData()
      expect(received.get('study_plan_id')).toBe('42')
      expect(await (received.get('audio') as File).text()).toBe('test bytes')
      return Response.json({ text: 'ciao' })
    })
    vi.stubGlobal('fetch', backend)
    expect(
      await (await proxyBackend(request, 'http://backend:8000')).json()
    ).toEqual({ text: 'ciao' })
  })

  it('delivers SSE frames before the upstream stream closes', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(stream, {
            headers: { 'content-type': 'text/event-stream' },
          })
      )
    )
    const response = await proxyBackend(
      new Request('http://frontend/api/chat', { method: 'POST', body: '{}' })
    )
    expect(response.headers.get('x-accel-buffering')).toBe('no')
    const reader = response.body?.getReader()
    controller?.enqueue(new TextEncoder().encode('data: {"token":"hello"}\n\n'))
    expect(new TextDecoder().decode((await reader?.read())?.value)).toContain(
      'hello'
    )
    controller?.enqueue(new TextEncoder().encode('data: {"done":true}\n\n'))
    expect(new TextDecoder().decode((await reader?.read())?.value)).toContain(
      'done'
    )
    controller?.close()
    expect((await reader?.read())?.done).toBe(true)
  })

  it('preserves independent refresh cookies, statuses, binary bytes and timing headers', async () => {
    const headers = new Headers({
      'content-type': 'audio/mpeg',
      'x-tts-trace-id': 'trace',
    })
    headers.append('set-cookie', 'refresh_token=new; HttpOnly; Path=/')
    headers.append('set-cookie', 'other=value; Path=/')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([0, 255, 10]), { status: 201, headers })
      )
    )
    const response = await proxyBackend(
      new Request('http://frontend/api/tts', { method: 'POST', body: '{}' })
    )
    expect(response.status).toBe(201)
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(response.headers.get('x-tts-trace-id')).toBe('trace')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0, 255, 10])
    )
  })

  it('keeps API error responses and query strings intact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        expect(url.search).toBe('?q=hello%20world')
        return Response.json({ detail: 'Unauthorized' }, { status: 401 })
      })
    )
    const response = await proxyBackend(
      new Request('http://frontend/api/resource?q=hello%20world')
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ detail: 'Unauthorized' })
  })

  it('propagates cancellation and maps connection failures to 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    expect(
      (await proxyBackend(new Request('http://frontend/api/config'))).status
    ).toBe(502)
    const controller = new AbortController()
    controller.abort()
    await expect(
      proxyBackend(
        new Request('http://frontend/api/chat', { signal: controller.signal })
      )
    ).rejects.toThrow('offline')
  })
})
