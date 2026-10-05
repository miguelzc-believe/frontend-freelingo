import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAuthStore } from '@/store/auth'
import { useLanguageStore } from '@/store/language'
import type { GrammarNativeHelp, GrammarTopic } from '@/data/grammar'
import type { TargetLanguage } from '@/lib/target-languages'

const { mockGetTopics, mockGetNativeHelp } = vi.hoisted(() => ({
  mockGetTopics: vi.fn(),
  mockGetNativeHelp: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'languages' ? `language:${key}` : key,
}))
vi.mock('@/data/grammar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/grammar')>()),
  getGrammarTopics: mockGetTopics,
  getGrammarNativeHelp: mockGetNativeHelp,
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
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

import GrammarDetailPage from '@/app/(app)/grammar/[slug]/page'

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

const nativeHelp: GrammarNativeHelp = {
  summary: 'Native summary',
  explanation: 'Native explanation',
  key_points: ['Remember this'],
  examples: [{ sentence: 'Ich lerne.', note: 'I am learning.' }],
  common_traps: [{ mistake: 'Wrong form', fix: 'Use this form' }],
  mini_glossary: [
    { term: 'Verb', meaning: 'Action word', note: 'A useful note' },
  ],
}

const topic: GrammarTopic = {
  slug: 'present-simple',
  title: 'Present simple',
  level: 'A1',
  category: 'Tenses',
  summary: 'Talk about routines.',
  structure: 'subject + verb',
  explanation:
    'Use **do** daily.\n\n- Add `-s` for he/she.\n- Keep the base form.\n| **Subject** | `verb` |',
  rules: ['Use it for habits.'],
  examples: [{ text: 'She works.', note: 'A daily routine.' }],
  common_mistakes: [
    { wrong: 'She work.', correct: 'She works.', note: 'Third person.' },
  ],
  related: ['past-simple', 'missing-topic'],
}

const relatedTopic: GrammarTopic = {
  ...topic,
  slug: 'past-simple',
  title: 'Past simple',
  level: 'A2',
  related: [],
}

function setup({
  topics = [topic, relatedTopic],
  nativeLanguage = 'es',
}: {
  topics?: GrammarTopic[]
  nativeLanguage?: string | null
} = {}) {
  mockGetTopics.mockResolvedValue(topics)
  mockGetNativeHelp.mockResolvedValue(nativeHelp)
  useAuthStore.setState({
    user: nativeLanguage
      ? ({ native_language: nativeLanguage } as never)
      : null,
  })
  useLanguageStore.setState({ activeLanguage: german })
  return render(<GrammarDetailPage params={{ slug: 'present-simple' }} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null })
  useLanguageStore.setState({ activeLanguage: null })
})

describe('GrammarDetailPage', () => {
  it('keeps duplicate authored nodes distinct when an unrelated section changes', async () => {
    const repeated = {
      ...topic,
      explanation:
        '| **same** `same` **same** | **same** `same` **same** |\n\n| **same** `same` **same** | **same** `same` **same** |',
      rules: ['Repeated rule', 'Repeated rule'],
      examples: [{ text: 'Repeated example' }, { text: 'Repeated example' }],
    }
    const view = setup({ topics: [repeated, relatedTopic] })
    mockGetNativeHelp.mockResolvedValue({
      ...nativeHelp,
      key_points: ['Repeated point', 'Repeated point'],
      examples: [nativeHelp.examples[0], nativeHelp.examples[0]],
      common_traps: [nativeHelp.common_traps[0], nativeHelp.common_traps[0]],
      mini_glossary: [nativeHelp.mini_glossary[0], nativeHelp.mini_glossary[0]],
    })
    await screen.findAllByText('Repeated point')
    const cells = screen.getAllByRole('cell')
    const words = [...document.querySelectorAll('strong')]
    const points = screen.getAllByText('Repeated point')
    expect(cells).toHaveLength(4)
    expect(words).toHaveLength(8)
    expect(new Set(words).size).toBe(8)
    expect(points).toHaveLength(2)
    expect(screen.getAllByText('Ich lerne.')).toHaveLength(2)
    expect(screen.getAllByText('Wrong form')).toHaveLength(2)
    expect(screen.getAllByText('Verb')).toHaveLength(2)
    view.rerender(<GrammarDetailPage params={{ slug: topic.slug }} />)
    expect(screen.getAllByRole('cell')).toEqual(cells)
    expect([...document.querySelectorAll('strong')]).toEqual(words)
    expect(screen.getAllByText('Repeated point')).toEqual(points)
    fireEvent.click(screen.getByRole('button', { name: /nativeHelpTitle/ }))
    expect(screen.getAllByRole('cell')).toEqual(cells)
    expect(screen.getAllByText('Repeated rule')).toHaveLength(2)
    expect(screen.getAllByText('Repeated example')).toHaveLength(2)
  })

  it('loads the topic for the selected target language', async () => {
    mockGetTopics.mockResolvedValue([topic, relatedTopic])
    useLanguageStore.setState({ activeLanguage: german })
    render(<GrammarDetailPage params={{ slug: topic.slug }} />)

    expect(screen.getByText('page-loading')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: topic.title })
    ).toBeInTheDocument()
    expect(mockGetTopics).toHaveBeenCalledWith('de')
    await waitFor(() =>
      expect(mockGetNativeHelp).toHaveBeenCalledWith(topic.slug, 'de')
    )
  })

  it('shows a retry action when topics cannot load, then renders after retry', async () => {
    mockGetTopics
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([topic])
    useLanguageStore.setState({ activeLanguage: german })
    render(<GrammarDetailPage params={{ slug: topic.slug }} />)

    const retry = await screen.findByRole('button', { name: 'retry' })
    expect(screen.getByText('error')).toBeInTheDocument()
    fireEvent.click(retry)
    expect(
      await screen.findByRole('heading', { name: topic.title })
    ).toBeInTheDocument()
    expect(mockGetTopics).toHaveBeenCalledTimes(2)
  })

  it('renders rich explanation markup and all populated topic sections', async () => {
    setup()
    await screen.findByRole('heading', { name: topic.title })

    const explanation = screen.getByRole('table').querySelector('p')
    expect(explanation).toHaveTextContent('Use do daily.')
    expect(screen.getByText('do')).toHaveProperty('tagName', 'STRONG')
    expect(screen.getByText('-s')).toHaveProperty('tagName', 'CODE')
    expect(
      [...document.querySelectorAll('li')].some((item) =>
        item.textContent?.includes('Add -s for he/she.')
      )
    ).toBe(true)
    expect(screen.getByRole('table')).toHaveTextContent('Subject')
    expect(screen.getByText('subject + verb')).toBeInTheDocument()
    expect(screen.getByText('Use it for habits.')).toBeInTheDocument()
    expect(screen.getAllByText('She works.')).toHaveLength(2)
    expect(screen.getByText('Third person.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Past simple/ })).toHaveAttribute(
      'href',
      '/grammar/past-simple'
    )
    await screen.findByText('Native summary')
  })

  it('hides optional structure and topic sections when empty', async () => {
    const { structure: _structure, ...topicWithoutStructure } = topic
    void _structure
    const minimal = {
      ...topicWithoutStructure,
      rules: [],
      examples: [],
      common_mistakes: [],
      related: [],
    }
    setup({ topics: [minimal], nativeLanguage: null })

    await screen.findByRole('heading', { name: topic.title })
    expect(screen.queryByText('structure')).not.toBeInTheDocument()
    expect(screen.queryByText('keyRules')).not.toBeInTheDocument()
    expect(screen.queryByText('examples')).not.toBeInTheDocument()
    expect(screen.queryByText('commonMistakes')).not.toBeInTheDocument()
    expect(screen.queryByText('relatedTopics')).not.toBeInTheDocument()
    expect(screen.queryByText('nativeHelpTitle')).not.toBeInTheDocument()
  })

  it('opens A1 native-language help automatically and renders returned details', async () => {
    setup()

    expect(await screen.findByText('Native summary')).toBeInTheDocument()
    expect(screen.getByText('Native explanation')).toBeInTheDocument()
    expect(screen.getByText('Remember this')).toBeInTheDocument()
    expect(screen.getByText('Ich lerne.')).toBeInTheDocument()
    expect(screen.getByText('Wrong form')).toBeInTheDocument()
    expect(screen.getByText('Verb')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /nativeHelpTitle/ })
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('lets learners retry failed native-language help generation', async () => {
    mockGetTopics.mockResolvedValue([topic])
    mockGetNativeHelp
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(nativeHelp)
    useAuthStore.setState({ user: { native_language: 'es' } as never })
    useLanguageStore.setState({ activeLanguage: german })
    render(<GrammarDetailPage params={{ slug: topic.slug }} />)

    const retry = await screen.findByRole('button', { name: 'retry' })
    fireEvent.click(retry)
    expect(await screen.findByText('Native summary')).toBeInTheDocument()
    expect(mockGetNativeHelp).toHaveBeenCalledTimes(2)
  })

  it('starts native help closed for higher-level topics and toggles it on demand', async () => {
    const higherLevel = { ...topic, level: 'B1' }
    setup({ topics: [higherLevel] })

    const toggle = await screen.findByRole('button', {
      name: /nativeHelpTitle/,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Let the topic-reset effect settle before toggling the newly loaded topic.
    await waitFor(() =>
      expect(screen.queryByText('page-loading')).not.toBeInTheDocument()
    )
    fireEvent.click(toggle)
    expect(await screen.findByText('Native summary')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
