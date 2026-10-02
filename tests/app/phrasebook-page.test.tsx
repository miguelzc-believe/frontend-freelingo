import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type {
  PhrasebookCategory,
  PhrasebookNativeHelp,
} from '@/data/phrasebook'

const { mockCategories, mockNativeHelp, mockAudioPlayer, mockTranslate } =
  vi.hoisted(() => ({
    mockCategories: vi.fn(),
    mockNativeHelp: vi.fn(),
    mockAudioPlayer: vi.fn(),
    mockTranslate: (key: string) => key,
  }))

vi.mock('use-intl', () => ({ useTranslations: () => mockTranslate }))
vi.mock('@/data/phrasebook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/phrasebook')>()
  return {
    ...actual,
    getPhrasebookCategories: mockCategories,
    getPhrasebookNativeHelp: mockNativeHelp,
  }
})
vi.mock('@/components/ui/AudioPlayer', () => ({
  AudioPlayer: (props: { text: string; size: string; audioUrl: string }) => {
    mockAudioPlayer(props)
    return <button aria-label={`audio ${props.text}`} />
  },
}))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>loading</div>,
}))

import PhrasebookPage from '@/app/(app)/phrasebook/page'
import { useAuthStore } from '@/store/auth'
import { useLanguageStore } from '@/store/language'
import type { TargetLanguage } from '@/lib/target-languages'

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

const categories: PhrasebookCategory[] = [
  {
    id: 'greetings',
    level: 'A1',
    situation: 'Greetings',
    icon: '👋',
    phrases: [
      { text: 'Good morning', context: 'At work', register: 'formal' },
      { text: 'Hi there', context: '', register: 'informal' },
    ],
  },
  {
    id: 'travel',
    level: 'B1',
    situation: 'Travel plans',
    icon: '🚆',
    phrases: [
      {
        text: 'I need a ticket',
        context: 'At the station',
        register: 'formal',
      },
      { text: 'Where is the train?', context: '', register: 'neutral' },
    ],
  },
]

const nativeHelp: PhrasebookNativeHelp = {
  summary: 'Use a polite greeting in formal settings.',
  usage_tips: ['Keep the opening brief.'],
  register_notes: ['Good morning is formal.'],
  phrase_notes: [{ phrase: 'Good morning', note: 'Use before noon.' }],
  common_traps: [
    { mistake: 'Say hi to a client', fix: 'Choose a formal greeting.' },
  ],
  mini_glossary: [
    { term: 'greeting', meaning: 'A way to say hello.', note: 'noun' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCategories.mockResolvedValue(categories)
  mockNativeHelp.mockResolvedValue(nativeHelp)
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

describe('PhrasebookPage', () => {
  it('loads the active target language and passes meaningful audio props', async () => {
    render(<PhrasebookPage />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('Greetings')).toBeInTheDocument()
    expect(mockCategories).toHaveBeenCalledWith('de')
    expect(mockAudioPlayer).toHaveBeenCalledWith({
      text: 'Good morning',
      size: 'sm',
      audioUrl: '/api/phrasebook/audio/greetings/0?language=de',
    })
    expect(mockAudioPlayer).toHaveBeenCalledWith({
      text: 'I need a ticket',
      size: 'sm',
      audioUrl: '/api/phrasebook/audio/travel/0?language=de',
    })
  })

  it('uses en-GB when no target language is selected', async () => {
    useLanguageStore.setState({ activeLanguage: null })
    render(<PhrasebookPage />)

    expect(await screen.findByText('Greetings')).toBeInTheDocument()
    expect(mockCategories).toHaveBeenCalledWith('en-GB')
    expect(mockAudioPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: expect.stringContaining('language=en-GB'),
      })
    )
  })

  it('shows a load error and retries with the selected language', async () => {
    mockCategories.mockRejectedValueOnce(new Error('offline'))
    render(<PhrasebookPage />)

    expect(await screen.findByText('error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(await screen.findByText('Greetings')).toBeInTheDocument()
    expect(mockCategories).toHaveBeenNthCalledWith(1, 'de')
    expect(mockCategories).toHaveBeenNthCalledWith(2, 'de')
  })

  it('applies level, register, and search together, then clears all filters', async () => {
    render(<PhrasebookPage />)
    await screen.findByText('Greetings')

    fireEvent.click(screen.getByRole('button', { name: 'B1' }))
    fireEvent.click(screen.getByRole('button', { name: 'formal' }))
    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'ticket' },
    })

    expect(screen.getByText('Travel plans')).toBeInTheDocument()
    expect(screen.getByText('I need a ticket')).toBeInTheDocument()
    expect(screen.queryByText('Where is the train?')).not.toBeInTheDocument()
    expect(screen.queryByText('Greetings')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'not a phrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'clearFilters' }))

    expect(screen.getByText('Greetings')).toBeInTheDocument()
    expect(screen.getByText('Travel plans')).toBeInTheDocument()
    expect(screen.getByText('Where is the train?')).toBeInTheDocument()
  })

  it('renders native help content after generation succeeds', async () => {
    render(<PhrasebookPage />)
    await screen.findByText('Greetings')
    fireEvent.click(screen.getByRole('button', { name: 'nativeHelpShow' }))

    expect(await screen.findByText(nativeHelp.summary)).toBeInTheDocument()
    expect(screen.getByText(nativeHelp.usage_tips[0]!)).toBeInTheDocument()
    expect(screen.getByText(nativeHelp.register_notes[0]!)).toBeInTheDocument()
    expect(
      screen.getByText(nativeHelp.phrase_notes[0]!.note)
    ).toBeInTheDocument()
    expect(
      screen.getByText(nativeHelp.common_traps[0]!.fix)
    ).toBeInTheDocument()
    expect(
      screen.getByText(nativeHelp.mini_glossary[0]!.meaning)
    ).toBeInTheDocument()
    expect(mockNativeHelp).toHaveBeenCalledWith('greetings', 'de')
  })

  it('offers retry when native help fails, then displays the successful retry', async () => {
    mockNativeHelp.mockRejectedValueOnce(new Error('offline'))
    render(<PhrasebookPage />)
    await screen.findByText('Greetings')
    fireEvent.click(screen.getByRole('button', { name: 'nativeHelpShow' }))
    fireEvent.click(await screen.findByRole('button', { name: 'retry' }))

    expect(await screen.findByText(nativeHelp.summary)).toBeInTheDocument()
    await waitFor(() => expect(mockNativeHelp).toHaveBeenCalledTimes(2))
    expect(mockNativeHelp).toHaveBeenNthCalledWith(2, 'greetings', 'de')
  })
})
