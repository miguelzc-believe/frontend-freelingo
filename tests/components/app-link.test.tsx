import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppLink from '@/components/ui/app-link'

vi.unmock('@/components/ui/app-link')
const { linkProps } = vi.hoisted(() => ({ linkProps: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => {
    linkProps({ to, ...props })
    return <a {...props} />
  },
}))

describe('app link', () => {
  it('defaults to root while forwarding content and accessibility attributes', () => {
    render(<AppLink aria-label="Home">Home</AppLink>)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(linkProps).toHaveBeenCalledWith(
      expect.objectContaining({ to: '.', href: '/' })
    )
  })

  it('preserves complete hrefs, target and rel for external navigation', () => {
    render(
      <AppLink href="/grammar?level=A1#examples" target="_blank" rel="noopener">
        Grammar
      </AppLink>
    )
    expect(screen.getByRole('link', { name: 'Grammar' })).toHaveAttribute(
      'href',
      '/grammar?level=A1#examples'
    )
    expect(linkProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: '.', target: '_blank', rel: 'noopener' })
    )
  })
})
