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

  it('dismisses once through a native backdrop sibling without wrapping form controls', () => {
    render(<ContactFormModal open onClose={onClose} />)
    const closeControls = screen.getAllByRole('button', { name: 'close' })
    expect(closeControls).toHaveLength(2)
    const [backdrop, headerClose] = closeControls
    if (!backdrop || !headerClose) throw new Error('Missing dismiss controls')
    const panel = screen
      .getByPlaceholderText('placeholderEmail')
      .closest('form')?.parentElement
    if (!panel) throw new Error('Contact panel did not render')

    expect(backdrop.tagName).toBe('BUTTON')
    expect(backdrop).toHaveAttribute('type', 'button')
    expect(backdrop).toHaveAttribute('tabindex', '-1')
    expect(backdrop.parentElement).toBe(panel.parentElement)
    expect(backdrop.nextElementSibling).toBe(panel)
    expect(panel.closest('button, [role="button"]')).toBeNull()
    expect(backdrop.querySelector('button, input, textarea, form')).toBeNull()

    fireEvent.click(screen.getByText('title'))
    fireEvent.click(screen.getByPlaceholderText('placeholderEmail'))
    fireEvent.change(screen.getByPlaceholderText('placeholderSubject'), {
      target: { value: 'Question' },
    })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('dismisses through Escape from inside the form and the header close control', () => {
    render(<ContactFormModal open onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('placeholderEmail'), {
      key: 'Escape',
    })
    expect(onClose).toHaveBeenCalledOnce()
    const headerClose = screen.getAllByRole('button', { name: 'close' }).at(-1)
    if (!headerClose) throw new Error('Missing header close control')
    fireEvent.click(headerClose)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps backdrop, header and Escape dismissal available while loading', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve
      })
    )
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

    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'sending' })).toBeDisabled()
    expect(screen.getByPlaceholderText('placeholderEmail')).toBeDisabled()
    const closeControls = screen.getAllByRole('button', { name: 'close' })
    expect(closeControls).toHaveLength(2)
    for (const control of closeControls) {
      expect(control).toBeEnabled()
      fireEvent.click(control)
    }
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)

    await act(async () => {
      resolveRequest?.(new Response(null, { status: 204 }))
    })
    expect(screen.getByText('✓ sent')).toBeInTheDocument()
  })
})
