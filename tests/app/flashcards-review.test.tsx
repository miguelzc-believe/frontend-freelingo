import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashcardsPage from '@/app/(app)/flashcards/page'

const { mockApiFetch, mockPlayAudio } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockPlayAudio: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/store/language', () => ({
  useLanguageStore: (selector: (state: object) => unknown) =>
    selector({ activeLanguage: { code: 'it-IT' } }),
}))

vi.mock('@/components/ui/AudioPlayer', () => ({
  AudioPlayer: ({ text, size }: { text: string; size?: 'sm' | 'md' }) => (
    <button
      type="button"
      aria-label={`Listen to ${text}`}
      onClick={() => mockPlayAudio(text, size)}
    >
      ▶
    </button>
  ),
}))

vi.mock('@/components/ui/VoiceRecorder', () => ({
  VoiceRecorder: ({
    onTranscription,
    disabled,
  }: {
    onTranscription: (text: string) => Promise<void>
    disabled: boolean
  }) => (
    <button disabled={disabled} onClick={() => void onTranscription(' CIAO! ')}>
      Transcribe
    </button>
  ),
}))

vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>loading</div>,
}))

const cards = [
  {
    id: 7,
    study_plan_id: 42,
    word: 'ciao',
    definition: 'hola',
    example_sentence: 'Ciao a tutti.',
    translation: 'hola',
    ease_factor: 2.5,
    interval: 0,
    repetitions: 0,
  },
  {
    id: 8,
    study_plan_id: 42,
    word: 'grazie',
    definition: 'gracias',
    example_sentence: 'Grazie mille.',
    translation: 'gracias',
    ease_factor: 2.5,
    interval: 0,
    repetitions: 0,
  },
]

function dueResponse(due = cards) {
  return new Response(JSON.stringify({ due, total: due.length }), {
    status: 200,
  })
}

describe('Flashcards review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides a named native flip action on both faces, separate from audio and grading', async () => {
    mockApiFetch.mockResolvedValue(dueResponse())
    render(<FlashcardsPage />)

    const reveal = await screen.findByRole('button', { name: 'tapToReveal' })
    expect(reveal.tagName).toBe('BUTTON')
    expect(reveal).toHaveAttribute('type', 'button')
    expect(reveal).toHaveClass(
      'focus-visible:outline-fl-fg',
      'min-h-[44px]',
      'px-4',
      'py-2'
    )
    reveal.focus()
    expect(reveal).toHaveFocus()
    const audio = screen.getByRole('button', { name: 'Listen to ciao' })
    expect(reveal).not.toContainElement(audio)
    expect(audio.parentElement?.closest('button, [role="button"]')).toBeNull()
    expect(screen.getByText('ciao')).toHaveAttribute('lang', 'it-IT')

    fireEvent.click(reveal)

    const hide = screen.getByRole('button', { name: 'tapToHide' })
    expect(hide).toBe(reveal)
    expect(hide).toHaveFocus()
    expect(screen.getByText('back')).toBeInTheDocument()
    expect(screen.getByText('Ciao a tutti.')).toHaveAttribute('lang', 'it-IT')
    expect(screen.getAllByText('hola')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Listen to ciao' })).toBeNull()
    const good = screen.getByRole('button', { name: 'good' })
    expect(hide).not.toContainElement(good)
    expect(good.parentElement?.closest('button, [role="button"]')).toBeNull()

    fireEvent.click(hide)

    expect(screen.getByRole('button', { name: 'tapToReveal' })).toHaveFocus()
    expect(screen.getByText('front')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'good' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Listen to ciao' })
    ).toBeInTheDocument()
  })

  it('plays audio without flipping and leaves non-action card content inert', async () => {
    mockApiFetch.mockResolvedValue(dueResponse())
    render(<FlashcardsPage />)

    const audio = await screen.findByRole('button', { name: 'Listen to ciao' })
    fireEvent.click(audio)

    expect(mockPlayAudio).toHaveBeenCalledExactlyOnceWith('ciao', 'md')
    expect(screen.getByText('front')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'good' })).toBeNull()
    fireEvent.click(screen.getByText('ciao'))
    expect(screen.getByText('front')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tapToReveal' }))
    fireEvent.click(screen.getByText('Ciao a tutti.'))
    expect(
      screen.getByRole('button', { name: 'tapToHide' })
    ).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('prevents concurrent reviews while one update is pending', async () => {
    let resolveReview: (response: Response) => void
    const pendingReview = new Promise<Response>((resolve) => {
      resolveReview = resolve
    })
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/api/flashcards/due') {
        return Promise.resolve(dueResponse(cards.slice(0, 1)))
      }
      return pendingReview
    })
    render(<FlashcardsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'tapToReveal' }))
    const goodButton = await screen.findByRole('button', { name: 'good' })
    fireEvent.click(goodButton)
    fireEvent.click(goodButton)

    await waitFor(() => {
      const reviewCalls = mockApiFetch.mock.calls.filter(([url]) =>
        String(url).endsWith('/review')
      )
      expect(reviewCalls).toHaveLength(1)
    })
    expect(goodButton).toBeDisabled()

    await act(async () => {
      resolveReview!(new Response(null, { status: 200 }))
    })
    await waitFor(() => {
      const dueCalls = mockApiFetch.mock.calls.filter(
        ([url]) => url === '/api/flashcards/due'
      )
      expect(dueCalls).toHaveLength(2)
    })
  })

  it('advances and turns the next card face-up after a successful review', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      url === '/api/flashcards/due'
        ? Promise.resolve(dueResponse())
        : Promise.resolve(new Response(null, { status: 200 }))
    )
    render(<FlashcardsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'tapToReveal' }))
    fireEvent.click(await screen.findByRole('button', { name: 'good' }))

    expect(await screen.findByText('grazie')).toBeInTheDocument()
    expect(screen.getByText('front')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'again' })
    ).not.toBeInTheDocument()
    const reviewCall = mockApiFetch.mock.calls.find(([url]) =>
      String(url).endsWith('/review')
    )
    expect(reviewCall?.[0]).toBe('/api/flashcards/7/review')
    expect(JSON.parse(reviewCall?.[1].body as string)).toEqual({ quality: 4 })
  })

  it('keeps the current card and its revealed face when review fails', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      url === '/api/flashcards/due'
        ? Promise.resolve(dueResponse())
        : Promise.resolve(new Response(null, { status: 500 }))
    )
    render(<FlashcardsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'tapToReveal' }))
    const goodButton = await screen.findByRole('button', { name: 'good' })
    fireEvent.click(goodButton)

    await waitFor(() => expect(goodButton).toBeEnabled())
    expect(screen.getAllByText('hola')).toHaveLength(2)
    expect(screen.queryByText('grazie')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'again' })).toBeInTheDocument()
  })

  it('preserves speech grading and returns to an unrevealed standard card', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      url === '/api/flashcards/due'
        ? Promise.resolve(dueResponse())
        : Promise.resolve(new Response(null, { status: 200 }))
    )
    render(<FlashcardsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'tapToReveal' }))
    fireEvent.click(screen.getByRole('button', { name: 'speakingMode' }))
    expect(screen.queryByRole('button', { name: 'tapToHide' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'good' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe' }))

    expect(await screen.findByText('Grazie mille.')).toBeInTheDocument()
    const reviewCall = mockApiFetch.mock.calls.find(([url]) =>
      String(url).endsWith('/review')
    )
    expect(reviewCall?.[0]).toBe('/api/flashcards/7/review')
    expect(JSON.parse(reviewCall?.[1].body as string)).toEqual({ quality: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'standardMode' }))
    expect(
      screen.getByRole('button', { name: 'tapToReveal' })
    ).toBeInTheDocument()
    expect(screen.getByText('grazie')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'good' })).toBeNull()
  })

  it('sends trimmed generation settings, closes and resets on success, then reloads due cards', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/api/flashcards/due') return Promise.resolve(dueResponse())
      if (url === '/api/flashcards/generate') {
        return Promise.resolve(new Response(null, { status: 200 }))
      }
      return Promise.resolve(new Response(null, { status: 200 }))
    })
    render(<FlashcardsPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: '+ generateBtn' })
    )
    fireEvent.change(screen.getByPlaceholderText('topicPlaceholder'), {
      target: { value: '  travel phrases  ' },
    })
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects.at(0)!, { target: { value: '15' } })
    fireEvent.change(selects.at(1)!, { target: { value: 'C1' } })
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.filter(([url]) => url === '/api/flashcards/due')
      ).toHaveLength(2)
    })
    const generationCall = mockApiFetch.mock.calls.find(
      ([url]) => url === '/api/flashcards/generate'
    )
    expect(generationCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(generationCall?.[1].body as string)).toEqual({
      topic: 'travel phrases',
      count: 15,
      cefr_level: 'C1',
    })
    expect(
      screen.queryByPlaceholderText('topicPlaceholder')
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ generateBtn' }))
    expect(screen.getByPlaceholderText('topicPlaceholder')).toHaveValue('')
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('15')
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('C1')
  })

  it.each([
    ['No active study plan found', 'noActivePlan'],
    ['Something went wrong', 'errorMessage'],
  ])(
    'shows the appropriate generation error for %s',
    async (detail, message) => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === '/api/flashcards/due') return Promise.resolve(dueResponse())
        return Promise.resolve(
          new Response(JSON.stringify({ detail }), { status: 400 })
        )
      })
      render(<FlashcardsPage />)

      fireEvent.click(
        await screen.findByRole('button', { name: '+ generateBtn' })
      )
      fireEvent.change(screen.getByPlaceholderText('topicPlaceholder'), {
        target: { value: 'travel' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'submit' }))

      expect(await screen.findByText(`✕ ${message}`)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('topicPlaceholder')).toHaveValue(
        'travel'
      )
    }
  )
})
