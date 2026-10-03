import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GrammarCategory } from '@/data/types'
import type { GrammarTopic } from '@/data/grammar'
import type { TargetLanguage } from '@/lib/target-languages'

const { mockGetTopics, mockTranslate } = vi.hoisted(() => ({
  mockGetTopics: vi.fn(),
  mockTranslate: (key: string) => key,
}))

vi.mock('use-intl', () => ({ useTranslations: () => mockTranslate }))
vi.mock('@/data/grammar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/grammar')>()),
  getGrammarTopics: mockGetTopics,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>page-loading</div>,
}))

import GrammarIndexPage from '@/app/(app)/grammar/page'
import { useLanguageStore } from '@/store/language'

const german: TargetLanguage = {
  code: 'de',
  name: 'Deutsch',
  nameEn: 'German',
  flagPath: '/flags/de.svg',
  iso639: 'de',
  script: 'latin',
  fontClass: '',
  usesWordSpacing: true,
}

const topics: GrammarTopic[] = [
  {
    slug: 'present-simple',
    title: 'Present simple',
    level: 'A1',
    category: 'Tenses',
    summary: 'Talk about daily routines and habits.',
    explanation: 'Use the present form.',
    rules: [],
    examples: [],
    common_mistakes: [],
    related: [],
  },
  {
    slug: 'question-forms',
    title: 'Question forms',
    level: 'A2',
    category: 'Questions',
    summary: 'Ask about plans and choices.',
    explanation: 'Put the auxiliary first.',
    rules: [],
    examples: [],
    common_mistakes: [],
    related: [],
  },
  {
    slug: 'past-simple',
    title: 'Past simple',
    level: 'B1',
    category: 'Tenses',
    summary: 'Describe completed actions.',
    explanation: 'Use the past form.',
    rules: [],
    examples: [],
    common_mistakes: [],
    related: [],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetTopics.mockResolvedValue(topics)
  useLanguageStore.setState({ activeLanguage: german })
})

describe('GrammarIndexPage', () => {
  it('shows loading before rendering populated topic cards and links', async () => {
    let resolveTopics!: (value: GrammarTopic[]) => void
    mockGetTopics.mockReturnValue(
      new Promise<GrammarTopic[]>((resolve) => {
        resolveTopics = resolve
      })
    )

    render(<GrammarIndexPage />)
    expect(screen.getByText('page-loading')).toBeInTheDocument()
    resolveTopics(topics)

    expect(
      await screen.findByRole('link', { name: /Present simple/ })
    ).toHaveAttribute('href', '/grammar/present-simple')
    expect(
      screen.getByText('Talk about daily routines and habits.')
    ).toBeInTheDocument()
    expect(screen.getAllByText('A1')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Questions' })
    ).toBeInTheDocument()
  })

  it('shows an error and retries a failed topic request', async () => {
    mockGetTopics
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(topics)
    render(<GrammarIndexPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'retry' }))
    expect(
      await screen.findByRole('link', { name: /Present simple/ })
    ).toBeInTheDocument()
    expect(mockGetTopics).toHaveBeenNthCalledWith(1, 'de')
    expect(mockGetTopics).toHaveBeenNthCalledWith(2, 'de')
  })

  it.each([
    ['title', 'PRESENT SIMPLE', 'Present simple'],
    ['summary', 'DAILY ROUTINES', 'Present simple'],
    ['category', 'QUESTIONS', 'Question forms'],
  ])('searches case-insensitively in the %s', async (_field, query, result) => {
    render(<GrammarIndexPage />)
    await screen.findByRole('link', { name: /Present simple/ })

    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: query },
    })

    expect(
      screen.getByRole('link', { name: new RegExp(result) })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('selects a category, and selecting it again restores all categories', async () => {
    render(<GrammarIndexPage />)
    await screen.findByRole('link', { name: /Present simple/ })

    fireEvent.click(screen.getByRole('button', { name: 'Tenses' }))
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(
      screen.queryByRole('link', { name: /Question forms/ })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tenses' }))
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('combines category and text filters and clears both from empty results', async () => {
    render(<GrammarIndexPage />)
    await screen.findByRole('link', { name: /Present simple/ })

    fireEvent.click(screen.getByRole('button', { name: 'Questions' }))
    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'routine' },
    })
    expect(screen.getByText('noResults')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'clearFilters' }))

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(
      screen.getByRole('button', { name: 'allCategories' })
    ).toBeInTheDocument()
  })

  it.each([
    [null, 'en-GB'],
    [german, 'de'],
  ])(
    'sorts raw categories using the target locale %s (%s)',
    async (language, locale) => {
      const categories: GrammarCategory[] = [
        'Tenses',
        'Questions',
        'Nouns',
        'Pronouns',
        'Adjectives & Adverbs',
        'Modals',
        'Conditionals',
        'Passive Voice',
        'Reported Speech',
        'Clauses',
        'Articles',
        'Prepositions',
        'Phrasal Verbs',
        'Advanced',
      ]
      mockGetTopics.mockResolvedValue(
        categories.map((category) => ({
          ...topics[0]!,
          slug: category,
          category,
        }))
      )
      useLanguageStore.setState({ activeLanguage: language })
      const compare = vi.spyOn(String.prototype, 'localeCompare')

      render(<GrammarIndexPage />)
      await screen.findByRole('button', { name: 'Tenses' })

      expect(
        screen.getAllByRole('button').map((button) => button.textContent)
      ).toEqual([
        'allCategories',
        'Adjectives & Adverbs',
        'Advanced',
        'Articles',
        'Clauses',
        'Conditionals',
        'Modals',
        'Nouns',
        'Passive Voice',
        'Phrasal Verbs',
        'Prepositions',
        'Pronouns',
        'Questions',
        'Reported Speech',
        'Tenses',
      ])
      expect(compare).toHaveBeenCalledWith(expect.any(String), locale)
    }
  )

  it('requests en-GB by default and refetches when the active language changes', async () => {
    const compare = vi.spyOn(String.prototype, 'localeCompare')
    useLanguageStore.setState({ activeLanguage: null })
    render(<GrammarIndexPage />)

    await screen.findByRole('link', { name: /Present simple/ })
    expect(mockGetTopics).toHaveBeenNthCalledWith(1, 'en-GB')

    compare.mockClear()
    act(() => useLanguageStore.setState({ activeLanguage: german }))
    await waitFor(() => expect(mockGetTopics).toHaveBeenCalledTimes(2))
    expect(mockGetTopics).toHaveBeenNthCalledWith(2, 'de')
    await screen.findByRole('link', { name: /Present simple/ })
    // The fetch returns the same topics reference, so the locale must invalidate the memo.
    expect(compare).toHaveBeenCalledWith(expect.any(String), 'de')
  })
})
