import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ error: mockLogError }),
}))

import GlobalError from '@/app/error'
import NotFound from '@/app/not-found'

describe('GlobalError', () => {
  beforeEach(() => {
    mockLogError.mockClear()
  })

  it('logs the error and renders the fallback with retry and dashboard actions', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('boom')} reset={reset} />)
    expect(mockLogError).toHaveBeenCalledWith(
      'Unhandled error',
      expect.any(Error)
    )
    expect(screen.getByText('label')).toBeInTheDocument()
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.queryByText(/digest/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  it('renders the digest when the error carries one', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    render(<GlobalError error={error} reset={() => {}} />)
    expect(screen.getByText('abc123')).toBeInTheDocument()
  })
})

describe('NotFound', () => {
  it('renders the 404 fallback with dashboard and home links', () => {
    render(<NotFound />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute(
      'href',
      '/'
    )
  })
})
