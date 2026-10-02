import { beforeEach, describe, expect, it, vi } from 'vitest'
import { secureRandomInt } from '@/lib/secure-random'

describe('secureRandomInt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns zero without requesting random values for a single choice', () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues')

    expect(secureRandomInt(1)).toBe(0)
    expect(getRandomValues).not.toHaveBeenCalled()
  })

  it('uses cryptographic values and rejects the biased remainder', () => {
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((values) => {
        const uint32Values = values as Uint32Array
        uint32Values[0] =
          getRandomValues.mock.calls.length === 1 ? 4294967295 : 4
        return values
      })

    expect(secureRandomInt(3)).toBe(1)
    expect(getRandomValues).toHaveBeenCalledTimes(2)
  })

  it.each([0, -1, 1.5, Number.NaN, 4294967296])(
    'rejects invalid exclusive bounds (%s)',
    (maxExclusive) => {
      expect(() => secureRandomInt(maxExclusive)).toThrow(RangeError)
    }
  )
})
