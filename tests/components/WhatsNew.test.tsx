import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'use-intl'
import WhatsNew from '@/components/whats-new/WhatsNew'

vi.unmock('@/components/whats-new/WhatsNew')

const seenKey = 'fl_whats_new_seen_v1.9.25'
const messages = {
  common: { close: 'Close' },
  whatsNew: {
    title: "What's New",
    version: 'v1.9.25',
    cta: 'Got it',
    entry10: { label: 'Later update', desc: 'Another improvement' },
    entry2: { label: 'Earlier update', desc: 'Try <bold>new features</bold>' },
  },
}

function renderWhatsNew() {
  return render(
    <IntlProvider locale="en-GB" messages={messages}>
      <WhatsNew />
    </IntlProvider>
  )
}

function expectDismissed() {
  expect(screen.queryByText("What's New")).not.toBeInTheDocument()
  expect(localStorage.getItem(seenKey)).toBe('1')
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('fl_tour_done', '1')
  vi.mocked(localStorage.setItem).mockClear()
})

afterEach(cleanup)

describe('WhatsNew', () => {
  it('uses a named native backdrop sibling without wrapping the panel in a button', () => {
    renderWhatsNew()
    const backdrop = screen.getByRole('button', { name: 'Close' })
    const panel = screen
      .getByText("What's New")
      .closest<HTMLElement>('.relative')

    expect(backdrop.tagName).toBe('BUTTON')
    expect(backdrop).toHaveAttribute('type', 'button')
    expect(backdrop).toHaveAttribute('tabindex', '-1')
    expect(panel).not.toBeNull()
    expect(backdrop.parentElement).toBe(panel?.parentElement)
    expect(backdrop).not.toContainElement(panel)
    expect(panel?.closest('button, [role="button"]')).toBeNull()
    expect(backdrop).toHaveClass('absolute', 'inset-0', 'backdrop-blur-sm')
    expect(panel).toHaveClass('relative', 'z-10')
  })

  it('dismisses from the backdrop and saves the existing seen version', () => {
    renderWhatsNew()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expectDismissed()
    expect(localStorage.setItem).toHaveBeenCalledExactlyOnceWith(seenKey, '1')
  })

  it('dismisses on Escape from inside the panel and removes the listener when hidden', () => {
    renderWhatsNew()
    const close = screen.getByRole('button', { name: 'Got it →' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Escape' })
    expectDismissed()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(localStorage.setItem).toHaveBeenCalledExactlyOnceWith(seenKey, '1')
  })

  it('preserves entries, rich text, panel interactions and the explicit close action', () => {
    renderWhatsNew()
    expect(screen.getByText('v1.9.25')).toBeInTheDocument()
    const labels = screen.getAllByText(/^(Earlier|Later) update$/)
    expect(labels.map((label) => label.textContent)).toEqual([
      'Earlier update',
      'Later update',
    ])
    expect(screen.getByText('new features').tagName).toBe('STRONG')
    expect(screen.getByText('new features')).toHaveClass(
      'text-fl-fg',
      'font-semibold'
    )
    expect(screen.getByText('Another improvement')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Earlier update'))
    fireEvent.click(screen.getByText("What's New"))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText("What's New")).toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Got it →' }))
    expectDismissed()
  })

  it('stays dismissed after remounting a seen version', () => {
    const view = renderWhatsNew()
    fireEvent.click(screen.getByRole('button', { name: 'Got it →' }))
    view.unmount()
    renderWhatsNew()
    expect(screen.queryByText("What's New")).not.toBeInTheDocument()
  })

  it('does not show or save a seen version before the tour is complete', () => {
    localStorage.removeItem('fl_tour_done')
    renderWhatsNew()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText("What's New")).not.toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('does not register dismissal for an already seen version', () => {
    localStorage.setItem(seenKey, '1')
    vi.mocked(localStorage.setItem).mockClear()
    renderWhatsNew()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText("What's New")).not.toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('removes the Escape listener on unmount without marking the version seen', () => {
    const view = renderWhatsNew()
    view.unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(seenKey)).toBeNull()
  })
})
