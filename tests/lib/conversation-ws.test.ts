import { setPublicConfig } from '@/lib/public-config'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildConversationWsUrl } from '@/lib/conversation-ws'

describe('buildConversationWsUrl', () => {
  const originalEnv = process.env.PUBLIC_API_URL

  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        host: 'localhost:3000',
      },
    })
  })

  afterEach(() => {
    setPublicConfig({ publicApiUrl: originalEnv ?? '', umamiWebsiteId: '' })
    vi.unstubAllGlobals()
  })

  it('uses PUBLIC_API_URL with https → wss', () => {
    setPublicConfig({
      publicApiUrl: 'https://api.example.com',
      umamiWebsiteId: '',
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('wss://api.example.com/ws/conversation')
  })

  it('uses PUBLIC_API_URL with http → ws', () => {
    setPublicConfig({
      publicApiUrl: 'http://api.example.com',
      umamiWebsiteId: '',
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('ws://api.example.com/ws/conversation')
  })

  it('derives ws:// from window.location when PUBLIC_API_URL is empty', () => {
    setPublicConfig({ publicApiUrl: '', umamiWebsiteId: '' })
    const url = buildConversationWsUrl()
    expect(url).toBe('ws://localhost:3000/ws/conversation')
  })

  it('derives wss:// from window.location when on https', () => {
    setPublicConfig({ publicApiUrl: '', umamiWebsiteId: '' })
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        host: 'app.example.com',
      },
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('wss://app.example.com/ws/conversation')
  })

  it('trims whitespace from PUBLIC_API_URL', () => {
    setPublicConfig({
      publicApiUrl: '  https://api.example.com  ',
      umamiWebsiteId: '',
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('wss://api.example.com/ws/conversation')
  })

  it('handles PUBLIC_API_URL with trailing slash', () => {
    setPublicConfig({
      publicApiUrl: 'https://api.example.com/',
      umamiWebsiteId: '',
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('wss://api.example.com/ws/conversation')
  })
})
