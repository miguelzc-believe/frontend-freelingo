import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VocabularyPage from '@/app/(app)/flashcards/vocabulary/page'

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/components/ui/AudioPlayer', () => ({ AudioPlayer: () => null }))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: () => <div>loading</div>,
}))
vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => null,
}))

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockResolvedValue(
    jsonResponse({ items: [], total: 0, page: 1, pages: 1 })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Saved vocabulary list', () => {
  it('shows the initial empty state after loading an unfiltered page', async () => {
    render(<VocabularyPage />)

    expect(await screen.findByText('myVocabularyEmpty')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/flashcards/vocabulary?page=1&limit=10&search='
    )
  })

  it('debounces search and shows the no-results state for the requested term', async () => {
    vi.useFakeTimers()
    render(<VocabularyPage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('myVocabularyEmpty')).toBeInTheDocument()
    mockApiFetch.mockClear()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'rare word' },
    })
    expect(mockApiFetch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(mockApiFetch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/flashcards/vocabulary?page=1&limit=10&search=rare+word'
    )
    expect(screen.getByText('myVocabularyNoResults')).toBeInTheDocument()
  })

  it('renders saved word details when the list is populated', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 12,
            word: 'serendipity',
            definition: 'Finding something pleasant by chance',
            example_sentence: 'It was pure serendipity.',
            translation: 'casualidad',
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
      })
    )
    render(<VocabularyPage />)

    expect(await screen.findByText('serendipity')).toBeInTheDocument()
    expect(
      screen.getByText('Finding something pleasant by chance')
    ).toBeInTheDocument()
    expect(screen.getByText('casualidad')).toBeInTheDocument()
    expect(screen.queryByText('myVocabularyEmpty')).not.toBeInTheDocument()
  })
})
