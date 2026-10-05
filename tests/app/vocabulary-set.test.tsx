import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { VocabularyNativeHelp, VocabularySet } from '@/data/types'

const { mockApiFetch, mockPush } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/lib/navigation', () => ({
  notFound: () => {
    throw new Error('not found')
  },
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>loading</div>,
}))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({
    children,
    languageCode,
    as: Element = 'span',
  }: {
    children: ReactNode
    languageCode: string
    as?: 'p' | 'span'
  }) => <Element data-language={languageCode}>{children}</Element>,
}))

import VocabularySetPage from '@/app/(app)/vocabulary/[setId]/page'
import { useAuthStore } from '@/store/auth'
import { useLanguageStore } from '@/store/language'
import type { TargetLanguage } from '@/lib/target-languages'

const german: TargetLanguage = {
  code: 'de-DE',
  name: 'Deutsch',
  nameEn: 'German',
  flagPath: '/flags/de.svg',
  iso639: 'de',
  script: 'latin',
  fontClass: '',
  usesWordSpacing: true,
}

const vocabularySet: VocabularySet = {
  id: 'set/one',
  level: 'A1',
  topic: 'Everyday words',
  unit_ref: 'unit-1',
  words: [
    {
      word: 'Haus',
      pos: 'noun',
      definition: 'A place to live',
      example: 'Das Haus ist groß.',
      ipa: '/haʊs/',
      frequency_rank: 12,
    },
  ],
}

const help: VocabularyNativeHelp = {
  summary: 'German nouns have grammatical gender.',
  study_tips: ['Learn each noun with its article.'],
  word_notes: [{ word: 'Haus', meaning: 'house', note: 'Neuter noun.' }],
  common_traps: [{ mistake: 'Der Haus', fix: 'Use das Haus.' }],
  mini_glossary: [{ term: 'das', meaning: 'the (neuter)' }],
  practice_prompts: ['Describe your house.'],
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockResolvedValue(jsonResponse({ set: vocabularySet }))
  useAuthStore.setState({
    accessToken: 'test-token',
    user: {
      id: 1,
      username: 'Learner',
      displayName: 'Learner',
      native_language: 'es',
      role: 'user',
      conversation_max_duration: 900,
      conversation_inactivity_timeout: 300,
    },
  })
  useLanguageStore.setState({ activeLanguage: german })
})

describe('VocabularySetPage', () => {
  it('retains duplicate words and help nodes during unrelated UI updates', async () => {
    mockApiFetch
      .mockResolvedValueOnce(
        jsonResponse({
          set: {
            ...vocabularySet,
            words: [vocabularySet.words[0], vocabularySet.words[0]],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          native_help: {
            ...help,
            study_tips: ['Repeated tip', 'Repeated tip'],
            word_notes: [
              { word: 'Repeated word', meaning: 'meaning', note: 'note' },
              { word: 'Repeated word', meaning: 'meaning', note: 'note' },
            ],
            common_traps: [
              { mistake: 'Repeated trap', fix: 'fix' },
              { mistake: 'Repeated trap', fix: 'fix' },
            ],
            mini_glossary: [
              { term: 'Repeated term', meaning: 'meaning' },
              { term: 'Repeated term', meaning: 'meaning' },
            ],
            practice_prompts: ['Repeated prompt', 'Repeated prompt'],
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ created: 2 }))
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)
    await screen.findByRole('heading', { name: 'Everyday words' })
    const words = screen.getAllByText('Haus')
    expect(words).toHaveLength(2)
    expect(words[0]).not.toBe(words[1])
    fireEvent.click(screen.getByRole('button', { name: /nativeHelpTitle/ }))
    fireEvent.click(screen.getByRole('button', { name: 'nativeHelpShow' }))
    await screen.findByText(help.summary)
    const duplicates = [
      'Repeated tip',
      'Repeated word',
      'Repeated trap',
      'Repeated term',
      'Repeated prompt',
    ].map((text) => screen.getAllByText(text))
    duplicates.forEach((nodes) => {
      expect(nodes).toHaveLength(2)
      expect(nodes[0]).not.toBe(nodes[1])
    })
    fireEvent.click(screen.getByRole('button', { name: 'addAll' }))
    await screen.findByText(/cardsAdded/)
    screen
      .getAllByText('Haus')
      .forEach((node, occurrence) => expect(node).toBe(words[occurrence]))
    duplicates.forEach((nodes) =>
      nodes.forEach((node) => expect(node).toBeInTheDocument())
    )
    const request = JSON.parse(mockApiFetch.mock.calls[2]![1].body)
    expect(request.flashcards).toHaveLength(2)
  })

  it('omits native help when the user has no native language', async () => {
    useAuthStore.setState({ user: null })
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)

    await screen.findByRole('heading', { name: 'Everyday words' })
    expect(screen.queryByRole('button', { name: /nativeHelpTitle/ })).toBeNull()
  })

  it('loads and renders the set for the active target language', async () => {
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Everyday words' })
    ).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/vocabulary/set%2Fone?language=de-DE'
    )
    expect(screen.getByText('Haus')).toHaveAttribute('data-language', 'de-DE')
    expect(screen.getByText('A place to live')).toHaveAttribute(
      'data-language',
      'de-DE'
    )
  })

  it('adds every word as flashcards and shows the success action', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ set: vocabularySet }))
      .mockResolvedValueOnce(jsonResponse({ created: 1 }))
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)

    fireEvent.click(await screen.findByRole('button', { name: 'addAll' }))
    expect(await screen.findByText(/cardsAdded/)).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/flashcards/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flashcards: [
          {
            word: 'Haus',
            definition: 'A place to live',
            example_sentence: 'Das Haus ist groß.',
            translation: '',
          },
        ],
      }),
    })
  })

  it.each([
    ['non-OK response', () => jsonResponse({}, 500)],
    ['thrown request', () => Promise.reject(new Error('network unavailable'))],
  ])('reports add-all failure for a %s', async (_case, response) => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ set: vocabularySet }))
      .mockImplementationOnce(response)
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)

    fireEvent.click(await screen.findByRole('button', { name: 'addAll' }))
    expect(await screen.findByText('addFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'addAll' })).toBeEnabled()
  })

  it('loads and retries native help for the target language', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ set: vocabularySet }))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ native_help: help }))
    render(<VocabularySetPage params={{ setId: 'set/one' }} />)

    const toggle = await screen.findByRole('button', {
      name: /nativeHelpTitle/,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(
      await screen.findByRole('button', { name: 'nativeHelpShow' })
    )
    const retry = await screen.findByRole('button', { name: 'retry' })
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/vocabulary/set%2Fone/native-help?language=de-DE',
      { method: 'POST' }
    )

    fireEvent.click(retry)
    expect(await screen.findByText(help.summary)).toBeInTheDocument()
    expect(screen.getAllByText('Haus')).toHaveLength(2)
    expect(
      screen
        .getAllByText('Haus')
        .every((node) => node.getAttribute('data-language') === 'de-DE')
    ).toBe(true)
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/vocabulary/set%2Fone/native-help?language=de-DE',
      { method: 'POST' }
    )
    await waitFor(() =>
      expect(screen.getByText('Use das Haus.')).toBeInTheDocument()
    )
  })
})
