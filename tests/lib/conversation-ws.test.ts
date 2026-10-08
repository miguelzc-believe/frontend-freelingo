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
    document.querySelector('meta[name="fl-public-api-url"]')?.remove()
    setPublicConfig({ publicApiUrl: originalEnv ?? '', umamiWebsiteId: '' })
    vi.unstubAllGlobals()
  })

  it.each<{ name: string; publicApiUrl: string; expectedUrl: string }>([
    {
      name: 'uses PUBLIC_API_URL with https → wss',
      publicApiUrl: 'https://api.example.com',
      expectedUrl: 'wss://api.example.com/ws/conversation',
    },
    {
      name: 'uses PUBLIC_API_URL with http → ws',
      publicApiUrl: 'http://api.example.com',
      expectedUrl: 'ws://api.example.com/ws/conversation',
    },
  ])('$name', ({ publicApiUrl, expectedUrl }) => {
    setPublicConfig({ publicApiUrl, umamiWebsiteId: '' })
    const url = buildConversationWsUrl()
    expect(url).toBe(expectedUrl)
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

  it('uses the public API URL rendered by the server', () => {
    setPublicConfig({ publicApiUrl: '', umamiWebsiteId: '' })
    const meta = document.createElement('meta')
    meta.name = 'fl-public-api-url'
    meta.content = 'http://localhost:8000'
    document.head.append(meta)

    try {
      expect(buildConversationWsUrl()).toBe(
        'ws://localhost:8000/ws/conversation'
      )
    } finally {
      meta.remove()
    }
  })

  it.each([
    ['empty', '', 'ws://localhost:3000/ws/conversation'],
    ['whitespace-only', ' \t\n ', 'ws://localhost:3000/ws/conversation'],
    [
      'no trailing slashes',
      'https://api.example.com/api',
      'wss://api.example.com/api/ws/conversation',
    ],
    [
      'many trailing slashes surrounded by whitespace',
      ' \thttp://api.example.com/api//////// \n',
      'ws://api.example.com/api/ws/conversation',
    ],
    ['all slashes', '/'.repeat(4096), 'ws://localhost:3000/ws/conversation'],
    ['trimmed slash-only', ' \t//// \n', 'ws://localhost:3000/ws/conversation'],
    [
      'interior slashes',
      'https://api.example.com//api///v1////',
      'wss://api.example.com//api///v1/ws/conversation',
    ],
    [
      'long trailing slash run',
      `https://api.example.com/api${'/'.repeat(4096)}`,
      'wss://api.example.com/api/ws/conversation',
    ],
    [
      'long nonterminal slash run followed by a trailing suffix',
      `https://api.example.com/${'/'.repeat(4096)}end////`,
      `wss://api.example.com/${'/'.repeat(4096)}end/ws/conversation`,
    ],
  ])(
    'preserves the exact URL for %s input',
    (_label, publicApiUrl, expected) => {
      setPublicConfig({ publicApiUrl, umamiWebsiteId: '' })
      expect(buildConversationWsUrl()).toBe(expected)
    }
  )

  it('handles PUBLIC_API_URL with trailing slash', () => {
    setPublicConfig({
      publicApiUrl: 'https://api.example.com/',
      umamiWebsiteId: '',
    })
    const url = buildConversationWsUrl()
    expect(url).toBe('wss://api.example.com/ws/conversation')
  })
})
