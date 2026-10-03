import { createRootRoute } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/routeTree.gen', () => ({ routeTree: createRootRoute() }))

import { getRouter } from '@/router'

const { stringifySearch, parseSearch } = getRouter().options

describe('router search serialization', () => {
  it('roundtrips primitives with URL encoding and preserves empty strings', () => {
    const search = {
      text: 'a & 日本語 + /?',
      empty: '',
      count: 0,
      yes: true,
      no: false,
      absent: null,
      missing: undefined,
    }
    const serialized = stringifySearch(search)
    expect(serialized).toContain('text=a+%26')
    expect(parseSearch(serialized)).toEqual({
      text: search.text,
      empty: '',
      count: '0',
      yes: 'true',
      no: 'false',
    })
    expect(stringifySearch({ absent: null, missing: undefined })).toBe('')
  })

  it.each([
    { secret: 'private-payload' },
    ['private-payload'],
    Symbol('private-payload'),
    1n,
    () => 'private-payload',
  ])(
    'rejects unsupported values without exposing keys or contents: %#',
    (value) => {
      expect(() => stringifySearch({ 'private-key': value })).toThrow(
        'Unsupported search parameter type'
      )
      try {
        stringifySearch({ 'private-key': value })
      } catch (error) {
        expect((error as Error).message).toBe(
          'Unsupported search parameter type'
        )
      }
    }
  )
})
