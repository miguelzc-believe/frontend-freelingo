import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.unmock('@/components/ui/app-image')

import AppImage from '@/components/ui/app-image'

describe('AppImage', () => {
  it('passes the alt text through to the rendered image', () => {
    render(<AppImage src="/logo.png" alt="FreeLingo" />)
    const image = screen.getByRole('img', { name: 'FreeLingo' })
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/logo.png')
  })

  it('keeps an empty alternative for decorative images', () => {
    render(<AppImage src="/logo.png" alt="" />)
    const image = screen.getByAltText('')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('alt', '')
  })

  it('defaults to lazy loading with async decoding', () => {
    render(<AppImage src="/logo.png" alt="Logo" />)
    const image = screen.getByRole('img', { name: 'Logo' })
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
  })

  it('uses eager loading when priority is set', () => {
    render(<AppImage src="/logo.png" alt="Logo" priority />)
    const image = screen.getByRole('img', { name: 'Logo' })
    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveAttribute('decoding', 'async')
  })

  it('lets an explicit loading prop win over the lazy default', () => {
    render(<AppImage src="/logo.png" alt="Logo" loading="eager" />)
    const image = screen.getByRole('img', { name: 'Logo' })
    expect(image).toHaveAttribute('loading', 'eager')
  })

  it('fills the parent box with absolute positioning while caller style wins', () => {
    render(<AppImage src="/logo.png" alt="Filled" fill />)
    const filled = screen.getByAltText('Filled')
    expect(filled.style.position).toBe('absolute')
    expect(filled.style.inset).toBe('0px')
    expect(filled.style.width).toBe('100%')
    expect(filled.style.height).toBe('100%')

    render(
      <AppImage src="/logo.png" alt="Custom" fill style={{ width: '50%' }} />
    )
    const custom = screen.getByAltText('Custom')
    expect(custom.style.position).toBe('absolute')
    expect(custom.style.inset).toBe('0px')
    expect(custom.style.width).toBe('50%')
    expect(custom.style.height).toBe('100%')
  })
})
