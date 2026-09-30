import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VocabularyIndexPage from '@/app/(app)/vocabulary/page'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api'

describe('vocabulary backend failures', () => {
  it.each([
    new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 }),
    new Response(JSON.stringify({ detail: 'Invalid payload' })),
  ])(
    'keeps the page renderable when sets are unavailable',
    async (response) => {
      vi.mocked(apiFetch).mockResolvedValueOnce(response)
      render(<VocabularyIndexPage />)
      expect(await screen.findByText('noResults')).toBeInTheDocument()
    }
  )
})
