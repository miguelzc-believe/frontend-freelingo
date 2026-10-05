import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FAQPage from '@/app/(app)/faq/page'
import { useAuthStore } from '@/store/auth'

const translations = vi.hoisted(() => ({ prefix: '' }))
vi.mock('use-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => `${translations.prefix}${key}`, {
      rich: (key: string) => `${translations.prefix}${key}`,
    }),
}))

describe('FAQ authored identity', () => {
  beforeEach(() => {
    translations.prefix = ''
    useAuthStore.setState({ user: null })
  })

  it('keeps question nodes and the open answer when translations change', () => {
    const view = render(<FAQPage />)
    const question = screen.getByRole('button', { name: 'q_start+' })
    fireEvent.click(question)
    expect(screen.getByText('a_start')).toBeInTheDocument()

    translations.prefix = 'translated: '
    view.rerender(<FAQPage />)

    expect(screen.getByRole('button', { name: 'translated: q_start−' })).toBe(
      question
    )
    expect(screen.getByText('translated: a_start')).toBeInTheDocument()
  })

  it('preserves workflow order, numbering and node identity across translations', () => {
    const view = render(<FAQPage />)
    fireEvent.click(screen.getByRole('button', { name: 'q_workflow+' }))
    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(6)
    steps.forEach((step, index) =>
      expect(step).toHaveTextContent(`${index + 1}.workflowStep${index + 1}`)
    )

    translations.prefix = 'translated: '
    view.rerender(<FAQPage />)

    const translated = within(screen.getByRole('list')).getAllByRole('listitem')
    translated.forEach((step, index) => {
      expect(step).toBe(steps[index])
      expect(step).toHaveTextContent(
        `${index + 1}.translated: workflowStep${index + 1}`
      )
    })
  })
})
