import { fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'use-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type User } from '@/store/auth'
import en from '../../messages/en.json'

vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
import FAQPage from '@/app/(app)/faq/page'

const user: User = {
  id: 1,
  username: 'fixture',
  displayName: 'Fixture',
  role: 'user',
  conversation_max_duration: 15,
  conversation_inactivity_timeout: 1,
}
function setup(role: User['role']) {
  useAuthStore.setState({ user: { ...user, role } })
  render(
    <IntlProvider locale="en" messages={en}>
      <FAQPage />
    </IntlProvider>
  )
}

describe('AI setup FAQ', () => {
  beforeEach(() => useAuthStore.setState({ user: null }))

  it('directs administrators to global settings rather than provider environment variables', () => {
    setup('admin')
    fireEvent.click(screen.getByRole('button', { name: /Which AI providers/ }))
    expect(screen.getByRole('link', { name: 'Settings → AI' })).toHaveAttribute(
      'href',
      '/settings#ai'
    )
    expect(screen.getByText('custom', { exact: true })).toBeInTheDocument()
    expect(screen.getByText(/Any OpenAI-compatible HTTP/)).toBeInTheDocument()
    expect(document.body).toHaveTextContent('globally for all learners')
    expect(document.body).not.toHaveTextContent('LLM_PROVIDER')
    expect(document.body).not.toHaveTextContent('OPENAI_API_KEY')
  })

  it('does not present administrator provider setup instructions to regular users', () => {
    setup('user')
    expect(
      screen.queryByRole('button', { name: /Which AI providers/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Settings → AI' })
    ).not.toBeInTheDocument()
  })
})
