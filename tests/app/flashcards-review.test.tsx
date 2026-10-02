import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashcardsPage from '@/app/(app)/flashcards/page'

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
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
  AudioPlayer: () => null,
}))

vi.mock('@/components/ui/VoiceRecorder', () => ({
  VoiceRecorder: () => null,
}))

vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>loading</div>,
}))

vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
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

    const word = await screen.findByText('ciao')
    fireEvent.click(word)
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

    fireEvent.click(await screen.findByText('ciao'))
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

    fireEvent.click(await screen.findByText('ciao'))
    const goodButton = await screen.findByRole('button', { name: 'good' })
    fireEvent.click(goodButton)

    await waitFor(() => expect(goodButton).toBeEnabled())
    expect(screen.getAllByText('hola')).toHaveLength(2)
    expect(screen.queryByText('grazie')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'again' })).toBeInTheDocument()
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
