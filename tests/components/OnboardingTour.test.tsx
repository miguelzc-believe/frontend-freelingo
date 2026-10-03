import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntlProvider } from 'use-intl'

const { configState } = vi.hoisted(() => ({
  configState: { stripeEnabled: false },
}))

vi.unmock('@/components/tour/OnboardingTour')

vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: typeof configState) => unknown) =>
    selector(configState),
}))

import OnboardingTour from '@/components/tour/OnboardingTour'

const messages = {
  common: { close: 'Close' },
  tour: {
    skip: 'skip',
    prev: 'prev',
    next: 'next',
    done: 'done',
    ...Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        `step${i + 1}`,
        {
          label: `step${i + 1}.label`,
          title: `step${i + 1}.title`,
          desc: `step${i + 1}.desc`,
        },
      ])
    ),
  },
}

function tour() {
  return (
    <IntlProvider locale="en-GB" messages={messages}>
      <OnboardingTour />
    </IntlProvider>
  )
}

async function advanceTour() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 160))
  })
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    configState.stripeEnabled = false
    localStorage.clear()
    vi.mocked(localStorage.setItem).mockClear()
  })

  afterEach(cleanup)

  it('uses a named native backdrop sibling without a button ancestor', () => {
    render(tour())
    const backdrop = screen.getByRole('button', { name: 'Close' })
    const panel = screen
      .getByText('step1.title')
      .closest<HTMLElement>('.relative')

    expect(backdrop.tagName).toBe('BUTTON')
    expect(backdrop).toHaveAttribute('type', 'button')
    expect(backdrop).toHaveAttribute('tabindex', '-1')
    expect(panel).not.toBeNull()
    expect(backdrop.parentElement).toBe(panel?.parentElement)
    expect(backdrop).not.toContainElement(panel)
    expect(panel?.closest('button, [role="button"]')).toBeNull()
    expect(backdrop).toHaveClass(
      'bg-fl-bg/80',
      'absolute',
      'inset-0',
      'backdrop-blur-sm'
    )
    expect(panel).toHaveClass('relative', 'z-10')
  })

  it('dismisses on Escape inside the panel and cleans up when hidden', async () => {
    render(tour())
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    await advanceTour()
    const previous = screen.getByRole('button', { name: /prev/ })
    previous.focus()
    fireEvent.keyDown(previous, { key: 'Escape' })

    expect(screen.queryByText('step2.title')).not.toBeInTheDocument()
    expect(localStorage.getItem('fl_tour_done')).toBe('1')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(localStorage.setItem).toHaveBeenCalledExactlyOnceWith(
      'fl_tour_done',
      '1'
    )
  })

  it('does not dismiss for panel clicks or non-Escape keys', () => {
    render(tour())
    fireEvent.click(screen.getByText('step1.title'))
    fireEvent.click(screen.getByText('step1.desc'))
    fireEvent.keyDown(screen.getByRole('button', { name: /next/ }), {
      key: 'Enter',
    })
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByText('step1.title')).toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('removes the Escape listener on unmount without saving dismissal', () => {
    const view = render(tour())
    view.unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem('fl_tour_done')).toBeNull()
  })

  it('shows the first step and navigates forward and back', async () => {
    render(tour())

    expect(await screen.findByText('step1.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    await advanceTour()

    expect(screen.getByText('step2.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /prev/ }))
    await advanceTour()

    expect(screen.getByText('step1.title')).toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('marks premium steps only when Stripe is enabled', async () => {
    configState.stripeEnabled = true
    const { rerender } = render(tour())

    expect(await screen.findByText('step1.title')).toBeInTheDocument()
    expect(screen.getByText('step1.label').parentElement).not.toHaveTextContent(
      '★'
    )
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    await advanceTour()
    expect(screen.getByText('step2.label').parentElement).toHaveTextContent('★')
    fireEvent.click(screen.getByRole('button', { name: /prev/ }))
    await advanceTour()

    configState.stripeEnabled = false
    rerender(tour())
    expect(screen.getByText('step1.label').parentElement).not.toHaveTextContent(
      '★'
    )
  })

  it('finishes on the last step and persists dismissal', async () => {
    render(tour())
    expect(await screen.findByText('step1.title')).toBeInTheDocument()

    for (let step = 0; step < 6; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/ }))
      await advanceTour()
    }

    expect(screen.getByText('step7.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(screen.queryByText('step7.title')).toBeNull()
    expect(localStorage.getItem('fl_tour_done')).toBe('1')
    expect(localStorage.setItem).toHaveBeenCalledExactlyOnceWith(
      'fl_tour_done',
      '1'
    )
  })

  it.each(['skip', 'backdrop'] as const)(
    'persists dismissal through %s',
    async (dismissal) => {
      render(tour())
      expect(await screen.findByText('step1.title')).toBeInTheDocument()

      if (dismissal === 'skip') {
        fireEvent.click(screen.getByRole('button', { name: 'skip' }))
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      }

      expect(screen.queryByText('step1.title')).toBeNull()
      expect(localStorage.getItem('fl_tour_done')).toBe('1')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(localStorage.setItem).toHaveBeenCalledExactlyOnceWith(
        'fl_tour_done',
        '1'
      )
    }
  )

  it('does not open after the tour was previously dismissed', () => {
    localStorage.setItem('fl_tour_done', '1')
    render(tour())
    expect(screen.queryByText('step1.title')).toBeNull()
    vi.mocked(localStorage.setItem).mockClear()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
