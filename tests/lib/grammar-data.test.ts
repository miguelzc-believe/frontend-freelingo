import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGrammarNativeHelp, getGrammarTopics } from '@/data/grammar'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))

describe('grammar data client', () => {
  beforeEach(() => api.mockReset())

  it('loads topics in the default language and encodes an explicit language', async () => {
    api.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ topics: [{ slug: 'article' }] }))
      )
    )
    expect(await getGrammarTopics()).toEqual([{ slug: 'article' }])
    expect(await getGrammarTopics('zh Hans')).toEqual([{ slug: 'article' }])
    expect(api).toHaveBeenNthCalledWith(1, '/api/grammar?language=en-GB')
    expect(api).toHaveBeenNthCalledWith(2, '/api/grammar?language=zh%20Hans')
  })

  it('returns an empty list for a failed response or absent topics', async () => {
    api.mockResolvedValueOnce(new Response(null, { status: 503 }))
    api.mockResolvedValueOnce(new Response('{}'))
    expect(await getGrammarTopics()).toEqual([])
    expect(await getGrammarTopics()).toEqual([])
  })

  it('requests native help with encoded identifiers and defaults to en-GB', async () => {
    api.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ native_help: { summary: 'help' } }))
      )
    )
    expect(await getGrammarNativeHelp('verb/form')).toEqual({ summary: 'help' })
    expect(await getGrammarNativeHelp('verb/form', 'de DE')).toEqual({
      summary: 'help',
    })
    expect(api).toHaveBeenNthCalledWith(
      1,
      '/api/grammar/verb%2Fform/native-help?language=en-GB',
      { method: 'POST' }
    )
    expect(api).toHaveBeenNthCalledWith(
      2,
      '/api/grammar/verb%2Fform/native-help?language=de%20DE',
      { method: 'POST' }
    )
  })

  it('returns no help for a failed response or absent help', async () => {
    api.mockResolvedValueOnce(new Response(null, { status: 404 }))
    api.mockResolvedValueOnce(new Response('{}'))
    expect(await getGrammarNativeHelp('topic')).toBeNull()
    expect(await getGrammarNativeHelp('topic')).toBeNull()
  })
})
