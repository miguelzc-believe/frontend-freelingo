import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageLoading } from '@/components/ui/page-loading'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/store/loading', () => ({
  useLoadingStore: { getState: () => ({ inc: vi.fn(), dec: vi.fn() }) },
}))

describe('PageLoading', () => {
  it('renders inline phrasing content as an implicitly named status output', () => {
    render(<PageLoading fullScreen={false} label="Please wait" />)
    const status = screen.getByRole('status', { name: 'Please wait' })
    expect(status.tagName).toBe('OUTPUT')
    expect(status).not.toHaveAttribute('role')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('● Please wait')
    expect(status).toHaveClass('animate-pulse', 'font-mono', 'text-xs')
  })

  it('keeps fullScreen subtext outside the output live region', () => {
    const { container } = render(
      <PageLoading label="Please wait" subtext="More detail" />
    )
    const status = screen.getByRole('status', { name: 'Please wait' })
    expect(status.tagName).toBe('OUTPUT')
    expect(status).not.toHaveAttribute('role')
    expect(status).toHaveAttribute('aria-busy', 'true')
    const subtext = screen.getByText('More detail')
    expect(status).not.toContainElement(subtext)
    expect(subtext.parentElement).toBe(status.parentElement)
    expect(status.parentElement).toHaveClass(
      'flex',
      'flex-col',
      'items-center',
      'gap-3'
    )
    expect(container.firstChild).not.toHaveAttribute('aria-busy')
    expect(container.firstChild).not.toHaveAttribute('aria-label')
  })

  it('preserves the default label and optional dot', () => {
    render(<PageLoading showDot={false} />)
    expect(screen.getByRole('status', { name: 'loading' })).toHaveTextContent(
      'loading'
    )
    expect(screen.queryByText(/●/)).toBeNull()
  })
})
