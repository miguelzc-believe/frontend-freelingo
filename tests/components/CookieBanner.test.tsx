import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CookieBanner } from '@/components/CookieBanner'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(localStorage.getItem).mockImplementation(() => null)
  vi.mocked(localStorage.setItem).mockImplementation(() => {})
})

describe('cookie consent banner', () => {
  it('shows consent when no preference is stored and hides after accepting', async () => {
    render(<CookieBanner />)

    expect(await screen.findByText('message')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'learnMore' })).toHaveAttribute(
      'href',
      '/privacy'
    )
    fireEvent.click(screen.getByRole('button', { name: 'accept' }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'fl_cookie_consent',
      'accepted'
    )
    expect(screen.queryByText('message')).not.toBeInTheDocument()
  })

  it('stays hidden when consent already exists', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('accepted')
    const { container } = render(<CookieBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('fails closed when local storage is unavailable', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { container } = render(<CookieBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dismisses the banner when saving consent fails', async () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    render(<CookieBanner />)
    fireEvent.click(await screen.findByRole('button', { name: 'accept' }))
    expect(screen.queryByText('message')).not.toBeInTheDocument()
  })
})
