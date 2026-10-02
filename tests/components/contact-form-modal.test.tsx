import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ContactFormModal } from '@/components/ui/contact-form-modal'

describe('ContactFormModal', () => {
  const onClose = vi.fn()

  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    onClose.mockReset()
  })

  it('submits the form, reports success and closes after the success delay', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.useFakeTimers()
    const { rerender } = render(<ContactFormModal open onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('placeholderEmail'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('placeholderSubject'), {
      target: { value: 'Question' },
    })
    fireEvent.change(screen.getByPlaceholderText('placeholderDescription'), {
      target: { value: 'Please help me.' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'learner@example.com',
          subject: 'Question',
          description: 'Please help me.',
        }),
      })
    )
    expect(screen.getByText('✓ sent')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('placeholderEmail')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(onClose).toHaveBeenCalledOnce()

    rerender(<ContactFormModal open={false} onClose={onClose} />)
    rerender(<ContactFormModal open onClose={onClose} />)
    expect(screen.getByPlaceholderText('placeholderEmail')).toHaveValue('')
    expect(screen.queryByText('✓ sent')).toBeNull()
  })

  it.each([
    [
      'server detail',
      async () =>
        new Response(JSON.stringify({ detail: 'Try again' }), { status: 500 }),
      'Try again',
    ],
    [
      'generic server error',
      async () => new Response('invalid JSON', { status: 500 }),
      'errorGeneric',
    ],
    [
      'network failure',
      async () => Promise.reject(new Error('offline')),
      'errorGeneric',
    ],
  ])('shows the right error after a %s', async (_name, response, expected) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(response)
    render(<ContactFormModal open onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('placeholderEmail'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('placeholderSubject'), {
      target: { value: 'Question' },
    })
    fireEvent.change(screen.getByPlaceholderText('placeholderDescription'), {
      target: { value: 'Please help me.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled()
  })

  it('closes on Escape or backdrop clicks but keeps clicks inside the form open', () => {
    const { container } = render(<ContactFormModal open onClose={onClose} />)
    const backdrop = container.firstElementChild
    const modal = backdrop?.firstElementChild

    if (!backdrop || !modal) throw new Error('Contact modal did not render')

    fireEvent.click(screen.getByText('title'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(backdrop)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
