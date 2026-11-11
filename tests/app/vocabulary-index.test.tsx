import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VocabularyIndexPage from '@/app/(app)/vocabulary/page'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  language: { code: 'ja-JP' } as { code: string } | null,
}))
vi.mock('use-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values ? `${key} ${values.count}` : key,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.api }))
vi.mock('@/store/language', () => ({
  useLanguageStore: (
    select: (state: { activeLanguage: typeof mocks.language }) => unknown
  ) => select({ activeLanguage: mocks.language }),
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const sets = [
  {
    id: 'food-1',
    topic: 'Food and drink',
    level: 'A1',
    unit_ref: 'unit 1',
    words: [{}, {}],
  },
  {
    id: 'travel-2',
    topic: 'Travel',
    level: 'B1',
    unit_ref: 'unit 2',
    words: [{}],
  },
]

describe('vocabulary index', () => {
  beforeEach(() => {
    mocks.api
      .mockReset()
      .mockResolvedValue(new Response(JSON.stringify({ sets })))
    mocks.language = { code: 'ja-JP' }
  })

  it('shows sets and counts, filters levels and clears combined search filters', async () => {
    render(<VocabularyIndexPage />)
    expect(
      await screen.findByRole('link', { name: /Food and drink/ })
    ).toHaveAttribute('href', '/vocabulary/food-1')
    expect(mocks.api).toHaveBeenCalledWith('/api/vocabulary?language=ja-JP')
    expect(screen.getByText(/sets 2 · 3 words/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'B1' }))
    expect(screen.queryByText('Food and drink')).not.toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'FOOD' },
    })
    expect(screen.getByText('noResults')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'clearFilters' }))
    expect(screen.getByText('Food and drink')).toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
  })

  it('searches by id, toggles a selected level off and supports the all filter', async () => {
    render(<VocabularyIndexPage />)
    await screen.findByText('Food and drink')
    const search = screen.getByPlaceholderText('searchPlaceholder')
    fireEvent.change(search, { target: { value: 'travel-2' } })
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(screen.queryByText('Food and drink')).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'A1' }))
    expect(screen.queryByText('Travel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A1' }))
    expect(screen.getByText('Travel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'B1' }))
    fireEvent.click(screen.getByRole('button', { name: 'all' }))
    expect(screen.getByText('Food and drink')).toBeInTheDocument()
  })

  it('defaults to British English and refetches when the language changes', async () => {
    mocks.language = null
    const view = render(<VocabularyIndexPage />)
    await screen.findByText('Food and drink')
    expect(mocks.api).toHaveBeenCalledWith('/api/vocabulary?language=en-GB')
    mocks.language = { code: 'de-DE' }
    view.rerender(<VocabularyIndexPage />)
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith('/api/vocabulary?language=de-DE')
    )
  })

  it('clears stale sets after a failed language request', async () => {
    const view = render(<VocabularyIndexPage />)
    await screen.findByText('Food and drink')
    mocks.api.mockRejectedValueOnce(new Error('offline'))
    mocks.language = { code: 'de-DE' }
    view.rerender(<VocabularyIndexPage />)
    expect(await screen.findByText('noResults')).toBeInTheDocument()
    expect(screen.queryByText('Food and drink')).not.toBeInTheDocument()
  })
})
