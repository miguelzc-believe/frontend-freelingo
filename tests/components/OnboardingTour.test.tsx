import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { configState } = vi.hoisted(() => ({
  configState: { stripeEnabled: false },
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: typeof configState) => unknown) =>
    selector(configState),
}))

import OnboardingTour from '@/components/tour/OnboardingTour'

async function advanceTour() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 160))
  })
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    configState.stripeEnabled = false
    localStorage.removeItem('fl_tour_done')
  })

  it('shows the first step and navigates forward and back', async () => {
    render(<OnboardingTour />)

    expect(await screen.findByText('step1.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    await advanceTour()

    expect(screen.getByText('step2.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prev/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /prev/ }))
    await advanceTour()

    expect(screen.getByText('step1.title')).toBeInTheDocument()
  })

  it('marks premium steps only when Stripe is enabled', async () => {
    configState.stripeEnabled = true
    const { rerender } = render(<OnboardingTour />)

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
    rerender(<OnboardingTour />)
    expect(screen.getByText('step1.label').parentElement).not.toHaveTextContent(
      '★'
    )
  })

  it('finishes on the last step and persists dismissal', async () => {
    render(<OnboardingTour />)
    expect(await screen.findByText('step1.title')).toBeInTheDocument()

    for (let step = 0; step < 6; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/ }))
      await advanceTour()
    }

    expect(screen.getByText('step7.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(screen.queryByText('step7.title')).toBeNull()
    expect(localStorage.getItem('fl_tour_done')).toBe('1')
  })

  it.each(['skip', 'backdrop'] as const)(
    'persists dismissal through %s',
    async (dismissal) => {
      const { container } = render(<OnboardingTour />)
      expect(await screen.findByText('step1.title')).toBeInTheDocument()

      if (dismissal === 'skip') {
        fireEvent.click(screen.getByRole('button', { name: 'skip' }))
      } else {
        const backdrop = container.querySelector('.absolute.inset-0')
        if (!backdrop) throw new Error('Tour backdrop did not render')
        fireEvent.click(backdrop)
      }

      expect(screen.queryByText('step1.title')).toBeNull()
      expect(localStorage.getItem('fl_tour_done')).toBe('1')
    }
  )

  it('does not open after the tour was previously dismissed', () => {
    localStorage.setItem('fl_tour_done', '1')
    render(<OnboardingTour />)
    expect(screen.queryByText('step1.title')).toBeNull()
  })
})
