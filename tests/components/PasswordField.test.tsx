import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordField } from '@/components/auth/PasswordField'

const visibilityLabels = {
  showPasswordLabel: 'Show password',
  hidePasswordLabel: 'Hide password',
}

function PasswordPair() {
  const [password, setPassword] = useState('first-password')
  const [confirmation, setConfirmation] = useState('second-password')

  return (
    <>
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        required
        {...visibilityLabels}
      />
      <PasswordField
        label="Confirm password"
        value={confirmation}
        onChange={setConfirmation}
        required
        {...visibilityLabels}
      />
    </>
  )
}

describe('PasswordField', () => {
  it('preserves the optional login input attributes and translated toggle labels', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PasswordField
        label="Login password"
        value="synthetic-password"
        onChange={onChange}
        autoComplete="current-password"
        showPasswordLabel="Reveal password"
        hidePasswordLabel="Conceal password"
      />
    )
    const input = screen.getByDisplayValue('synthetic-password')

    expect(container.querySelector('label')).toHaveTextContent('Login password')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
    expect(input).not.toBeRequired()
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('spellcheck', 'false')
    const toggle = screen.getByRole('button', { name: 'Reveal password' })
    expect(toggle).toHaveAttribute('type', 'button')
    expect(toggle.querySelector('svg circle')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'updated-password' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('updated-password')
    fireEvent.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Conceal password' })).toBe(
      toggle
    )
    expect(toggle.querySelector('svg line')).toBeInTheDocument()
    expect(toggle.querySelector('svg circle')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledTimes(1)

    fireEvent.click(toggle)
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Reveal password' })).toBe(toggle)
  })

  it('keeps registration values and visibility independent without adding autocomplete', () => {
    render(<PasswordPair />)
    const password = screen.getByDisplayValue('first-password')
    const confirmation = screen.getByDisplayValue('second-password')

    for (const input of [password, confirmation]) {
      expect(input).toBeRequired()
      expect(input).not.toHaveAttribute('autocomplete')
      expect(input).toHaveAttribute('type', 'password')
    }
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Show password' })[0]!
    )
    expect(password).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'password')
    fireEvent.change(password, { target: { value: 'only-first-changed' } })
    expect(password).toHaveValue('only-first-changed')
    expect(confirmation).toHaveValue('second-password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(confirmation).toHaveAttribute('type', 'text')
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Hide password' })[0]!
    )
    expect(password).toHaveAttribute('type', 'password')
    expect(confirmation).toHaveAttribute('type', 'text')
  })
})
