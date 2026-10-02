import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api'
import {
  getPhrasebookByLevel,
  getPhrasebookCategories,
  getPhrasebookNativeHelp,
} from '@/data/phrasebook'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))

const mockedApiFetch = vi.mocked(apiFetch)
const makeResponse = (ok: boolean, body?: unknown) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response

beforeEach(() => vi.resetAllMocks())

describe('getPhrasebookCategories', () => {
  it('returns categories and uses the default encoded language', async () => {
    const categories = [{ id: 'travel', phrases: [] }]
    mockedApiFetch.mockResolvedValue(makeResponse(true, { categories }))

    await expect(getPhrasebookCategories()).resolves.toEqual(categories)
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/phrasebook?language=en-GB'
    )
  })

  it('returns an empty list for a missing key or non-OK response without parsing', async () => {
    const missing = makeResponse(true, {})
    const failed = makeResponse(false)
    mockedApiFetch.mockResolvedValueOnce(missing).mockResolvedValueOnce(failed)

    await expect(getPhrasebookCategories()).resolves.toEqual([])
    await expect(getPhrasebookCategories()).resolves.toEqual([])
    expect(missing.json).toHaveBeenCalledOnce()
    expect(failed.json).not.toHaveBeenCalled()
  })

  it('encodes an explicit language and propagates transport errors', async () => {
    mockedApiFetch.mockResolvedValueOnce(makeResponse(true, { categories: [] }))
    await getPhrasebookCategories('zh CN/Traditional')
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/phrasebook?language=zh%20CN%2FTraditional'
    )

    mockedApiFetch.mockRejectedValueOnce(new Error('offline'))
    await expect(getPhrasebookCategories()).rejects.toThrow('offline')
  })
})

describe('getPhrasebookByLevel', () => {
  it('returns categories and encodes level and language in the request', async () => {
    const categories = [{ id: 'introductions', phrases: [] }]
    mockedApiFetch.mockResolvedValue(makeResponse(true, { categories }))

    await expect(getPhrasebookByLevel('A1/A2', 'fr FR')).resolves.toEqual(
      categories
    )
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/phrasebook/level/A1%2FA2?language=fr%20FR'
    )
  })

  it('falls back to an empty list for non-OK responses without parsing', async () => {
    const response = makeResponse(false)
    mockedApiFetch.mockResolvedValue(response)

    await expect(getPhrasebookByLevel('B1')).resolves.toEqual([])
    expect(response.json).not.toHaveBeenCalled()
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/phrasebook/level/B1?language=en-GB'
    )
  })

  it('propagates transport errors', async () => {
    mockedApiFetch.mockRejectedValue(new Error('offline'))
    await expect(getPhrasebookByLevel('B2')).rejects.toThrow('offline')
  })
})

describe('getPhrasebookNativeHelp', () => {
  it('returns native help and POSTs with an encoded category and language', async () => {
    const nativeHelp = { summary: 'Useful phrases', usage_tips: [] }
    mockedApiFetch.mockResolvedValue(
      makeResponse(true, { native_help: nativeHelp })
    )

    await expect(
      getPhrasebookNativeHelp('food/drink', 'es ES')
    ).resolves.toEqual(nativeHelp)
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/phrasebook/food%2Fdrink/native-help?language=es%20ES',
      { method: 'POST' }
    )
  })

  it('returns null for a missing key or non-OK response without parsing', async () => {
    const missing = makeResponse(true, {})
    const failed = makeResponse(false)
    mockedApiFetch.mockResolvedValueOnce(missing).mockResolvedValueOnce(failed)

    await expect(getPhrasebookNativeHelp('food')).resolves.toBeNull()
    await expect(getPhrasebookNativeHelp('food')).resolves.toBeNull()
    expect(missing.json).toHaveBeenCalledOnce()
    expect(failed.json).not.toHaveBeenCalled()
  })

  it('propagates transport errors', async () => {
    mockedApiFetch.mockRejectedValue(new Error('offline'))
    await expect(getPhrasebookNativeHelp('food')).rejects.toThrow('offline')
  })
})
