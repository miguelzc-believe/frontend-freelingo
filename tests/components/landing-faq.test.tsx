import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('use-intl', () => ({
  useTranslations: () => {
    const translate = (key: string) => key
    return Object.assign(translate, {
      rich: (
        key: string,
        values: { strong: (text: string) => React.ReactNode }
      ) => React.createElement('span', null, values.strong(key)),
    })
  },
}))

import { LandingFAQ } from '@/components/ui/landing-faq'

describe('LandingFAQ', () => {
  it('opens a rich answer and closes it when the same question is selected again', () => {
    render(<LandingFAQ />)
    const question = screen.getByRole('button', { name: /q_start/ })

    fireEvent.click(question)
    expect(screen.getByText('a_start')).toBeInTheDocument()
    expect(question).toHaveTextContent('−')

    fireEvent.click(question)
    expect(screen.queryByText('a_start')).not.toBeInTheDocument()
    expect(question).toHaveTextContent('+')
  })

  it('renders the six ordered steps for the workflow answer', () => {
    render(<LandingFAQ />)
    fireEvent.click(screen.getByRole('button', { name: /q_workflow/ }))

    const steps = screen.getByRole('list')
    expect(steps.querySelectorAll('li')).toHaveLength(6)
    expect(screen.getByText('workflowStep1')).toBeInTheDocument()
    expect(screen.getByText('workflowStep6')).toBeInTheDocument()
  })

  it('switches directly between questions and renders plain-text answers', () => {
    render(<LandingFAQ />)
    fireEvent.click(screen.getByRole('button', { name: /q_language/ }))
    expect(screen.getByText('a_language')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /q_assessment/ }))
    expect(screen.queryByText('a_language')).not.toBeInTheDocument()
    expect(screen.getByText('a_assessment')).toBeInTheDocument()
  })
})
