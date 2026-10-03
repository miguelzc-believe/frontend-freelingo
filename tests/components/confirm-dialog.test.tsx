import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function renderOpenConfirmDialog(
  props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}
) {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  const view = render(
    <ConfirmDialog
      open
      title="Delete item"
      message="Confirm deletion?"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  const dialog = screen.getByRole('alertdialog')
  return { ...view, dialog, onCancel, onConfirm }
}

function getDialogCancelButton(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: 'cancel' })
}

function getBackdropDismissButton(dialog: HTMLElement) {
  const backdrop = screen.getByRole('button', { name: 'close' })
  expect(dialog).not.toContainElement(backdrop)
  return backdrop
}

describe('ConfirmDialog', () => {
  it('uses a native sibling backdrop button instead of a button role around the dialog', () => {
    const { dialog } = renderOpenConfirmDialog()
    const backdrop = getBackdropDismissButton(dialog)

    expect(backdrop.tagName).toBe('BUTTON')
    expect(backdrop).toHaveAttribute('type', 'button')
    expect(backdrop).toHaveAttribute('tabindex', '-1')
    expect(backdrop.parentElement).toBe(dialog.parentElement)
    expect(backdrop).not.toContainElement(dialog)
    expect(dialog.closest('button, [role="button"]')).toBeNull()
  })

  it('returns focus to the opener and cancels on Escape exactly once', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount, dialog, onCancel } = renderOpenConfirmDialog()
    expect(getDialogCancelButton(dialog)).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)

    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('wraps keyboard focus in both directions and displays confirmation errors', () => {
    const { dialog } = renderOpenConfirmDialog({
      title: 'Saving',
      message: 'Please wait',
      error: 'Temporary failure',
    })
    const cancel = getDialogCancelButton(dialog)
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary failure')

    confirm.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
  })

  it('dismisses on pointer outside but never dismisses from pointer interaction inside the panel', () => {
    const { dialog, onCancel, onConfirm } = renderOpenConfirmDialog({
      danger: true,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
    })

    fireEvent.click(dialog)
    fireEvent.click(within(dialog).getByText('Confirm deletion?'))
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(getBackdropDismissButton(dialog))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels from the dialog cancel button exactly once', () => {
    const { dialog, onCancel } = renderOpenConfirmDialog()

    fireEvent.click(getDialogCancelButton(dialog))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('blocks Escape, outside clicks, and focus traversal while confirming', () => {
    const { dialog, onCancel, onConfirm } = renderOpenConfirmDialog({
      confirming: true,
    })
    const cancel = getDialogCancelButton(dialog)
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    const backdrop = getBackdropDismissButton(dialog)
    expect(cancel).toBeDisabled()
    expect(confirm).toBeDisabled()
    expect(backdrop).toBeDisabled()

    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    fireEvent(window, tab)
    expect(tab.defaultPrevented).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(backdrop)
    fireEvent.click(cancel)
    fireEvent.click(confirm)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
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
