const UINT32_RANGE = 4294967296
const UINT32_MAX = 4294967295

export function secureRandomInt(maxExclusive: number): number {
  if (
    !Number.isSafeInteger(maxExclusive) ||
    maxExclusive <= 0 ||
    maxExclusive > UINT32_MAX
  ) {
    throw new RangeError('maxExclusive must be an integer from 1 to 2^32 - 1')
  }

  if (maxExclusive === 1) return 0

  const acceptanceLimit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive
  const randomValues = new Uint32Array(1)

  do {
    globalThis.crypto.getRandomValues(randomValues)
  } while (randomValues[0]! >= acceptanceLimit)

  return randomValues[0]! % maxExclusive
}
