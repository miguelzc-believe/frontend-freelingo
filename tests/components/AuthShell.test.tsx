import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthShell } from '@/components/auth/AuthShell'

const brandClasses =
  'text-fl-fg font-code text-xl font-bold tracking-widest uppercase'

describe('AuthShell', () => {
  it('preserves the form branding, panel and caller-owned content', () => {
    const { container } = render(
      <AuthShell title="Sign in" tagline="Learn together">
        <form noValidate>
          <button type="submit">Submit</button>
        </form>
      </AuthShell>
    )
    expect(container.firstElementChild).toHaveClass(
      'bg-fl-bg flex min-h-screen items-center justify-center px-4'
    )
    expect(container.firstElementChild?.firstElementChild).toHaveClass(
      'w-full max-w-sm'
    )
    expect(screen.getByRole('img', { name: 'FreeLingo' })).toHaveAttribute(
      'src',
      '/logo.png'
    )
    expect(screen.getByRole('img')).toHaveAttribute('width', '100')
    expect(screen.getByRole('img')).toHaveAttribute('height', '100')
    expect(screen.getByRole('img')).toHaveClass('mb-4')
    expect(
      screen.getByRole('heading', { level: 1, name: 'FreeLingo' })
    ).toHaveClass(brandClasses)
    expect(screen.getByText('Learn together')).toHaveClass(
      'text-fl-caption text-fl-muted-2 mt-1 font-mono tracking-widest uppercase'
    )
    const header = screen.getByText('Sign in').parentElement
    expect(header).toHaveClass(
      'border-fl-border mb-6 flex items-center gap-2 border-b pb-4'
    )
    expect(header?.parentElement).toHaveClass(
      'border-fl-border bg-fl-surface border p-8'
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    expect(container.querySelector('form')).toHaveAttribute('novalidate')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders an explicit registration header aside without changing content', () => {
    render(
      <AuthShell
        title="Create account"
        tagline="Learn together"
        headerAside={<span>Invite active</span>}
      >
        <p>Registration form</p>
      </AuthShell>
    )
    expect(screen.getByText('Invite active').parentElement).toBe(
      screen.getByText('Create account').parentElement
    )
    expect(screen.getByText('Registration form')).toBeInTheDocument()
  })
})
