import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('ConfirmDialog', () => {
  it('returns focus to the opener and cancels on Escape', () => {
    const onCancel = vi.fn()
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const view = render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Confirm deletion?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    expect(screen.getByRole('button', { name: 'cancel' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('wraps keyboard focus in both directions and displays confirmation errors', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Saving"
        message="Please wait"
        error="Temporary failure"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    const cancel = screen.getByRole('button', { name: 'cancel' })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary failure')
    confirm.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('blocks Escape, backdrop clicks, and focus traversal while confirming', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        confirming
        title="Saving"
        message="Please wait"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    const cancel = screen.getByRole('button', { name: 'cancel' })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(cancel).toBeDisabled()
    expect(confirm).toBeDisabled()

    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    fireEvent(window, tab)
    expect(tab.defaultPrevented).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels on backdrop click but keeps clicks inside the dialog', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        danger
        title="Delete item"
        message="Confirm deletion?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(dialog)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  })

  it('renders nothing while closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Hidden"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
