// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from '@/server/security'

describe('explicit voice-message security policy', () => {
  it('allows same-origin capture worklets and session blob playback', () => {
    expect(securityHeaders['Permissions-Policy']).toBe(
      'camera=(), microphone=(self), geolocation=()'
    )
    expect(contentSecurityPolicy).toContain("worker-src 'self' blob:")
    expect(contentSecurityPolicy).toContain("media-src 'self' blob:")
  })

  it('does not permit obsolete VAD eval or cross-origin WebSocket transports', () => {
    expect(contentSecurityPolicy).not.toContain('wasm-unsafe-eval')
    expect(contentSecurityPolicy).not.toContain('ws:')
    expect(contentSecurityPolicy).not.toContain('wss:')
    expect(contentSecurityPolicy).toContain("connect-src 'self';")
  })
})
