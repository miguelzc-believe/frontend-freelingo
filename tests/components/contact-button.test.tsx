import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContactButton } from '@/components/ui/contact-button'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/components/ui/contact-form-modal', () => ({
  ContactFormModal: ({
    open,
    onClose,
  }: {
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog">
        <button onClick={onClose}>close contact</button>
      </div>
    ) : null,
}))

describe('contact button', () => {
  it('opens and closes the contact modal', () => {
    render(<ContactButton />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'contact' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close contact' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
