import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { LegalSection } from '@/components/legal/LegalSection'

vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('LegalDocument', () => {
  it('preserves linked small branding, document structure and exact supplied URLs', () => {
    render(
      <LegalDocument
        title="Terms of service"
        updated="Updated today"
        documentHref="/privacy?from=register&invite=a%2Bb"
        documentLabel="Privacy policy"
        backHref="/register?invite=a%2Bb"
        backLabel="Back to registration"
      >
        <LegalSection title="Scope" body="Document content" />
        <p>Contact details</p>
      </LegalDocument>
    )
    const logo = screen.getByRole('img', { name: 'FreeLingo' })
    expect(logo).toHaveAttribute('width', '48')
    expect(logo).toHaveAttribute('height', '48')
    expect(logo).toHaveClass('mb-3')
    expect(screen.getByRole('link', { name: 'FreeLingo' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(screen.getByText('common.tagline')).toBeInTheDocument()
    const title = screen.getByText('Terms of service')
    expect(title.parentElement).toHaveClass(
      'border-fl-border flex items-center gap-2 border-b pb-4'
    )
    const panel = title.parentElement?.parentElement
    expect(panel).toHaveClass(
      'border-fl-border bg-fl-surface space-y-8 border p-8'
    )
    expect(screen.getByText('Updated today')).toHaveClass(
      'text-fl-hint text-fl-muted-2 font-mono tracking-wide'
    )
    const crossLink = screen.getByRole('link', { name: 'Privacy policy' })
    expect(crossLink).toHaveAttribute(
      'href',
      '/privacy?from=register&invite=a%2Bb'
    )
    expect(
      screen.getByRole('link', { name: 'Back to registration' })
    ).toHaveAttribute('href', '/register?invite=a%2Bb')
    expect(crossLink.parentElement).toHaveClass(
      'border-fl-border flex gap-6 border-t pt-4'
    )
    expect(panel?.lastElementChild).toBe(crossLink.parentElement)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Scope' })
    ).toBeInTheDocument()
    expect(screen.getByText('Contact details')).toBeInTheDocument()
  })
})

describe('LegalSection', () => {
  it('preserves plain section markup without a list or footer', () => {
    const { container } = render(
      <LegalSection title="Scope" body="Body text" />
    )
    expect(container.firstElementChild?.tagName).toBe('SECTION')
    expect(container.firstElementChild).toHaveClass('space-y-3')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Scope' })
    ).toHaveClass(
      'text-fl-fg font-mono text-sm font-bold tracking-widest uppercase'
    )
    expect(screen.getByText('Body text')).toHaveClass(
      'text-fl-fg-2 font-mono text-sm leading-relaxed'
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('keeps the supplied item order and optional footer after the list', () => {
    const { container } = render(
      <LegalSection
        title="Data collected"
        body="Introduction"
        items={['First item', 'Second item']}
        footer="Footer text"
      />
    )
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent)
    ).toEqual(['—First item', '—Second item'])
    expect(screen.getByRole('list')).toHaveClass('space-y-1 pl-4')
    expect(screen.getByText('Footer text')).toBe(
      container.firstElementChild?.lastElementChild
    )
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })
})
