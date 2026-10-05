import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetchFreemium: vi.fn(),
  decrementFreemium: vi.fn(),
  dismissTooltip: vi.fn(),
  handleTextSelection: vi.fn(),
  push: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: object) => unknown) =>
    selector({
      user: {
        username: 'learner',
        displayName: 'Learner',
        avatarUrl: null,
        subscription_status: 'active',
      },
    }),
  isSubscribed: () => true,
  isFreemiumTrialActive: () => false,
}))
vi.mock('@/store/language', () => ({
  useLanguageStore: (selector: (state: object) => unknown) =>
    selector({ activeLanguage: { code: 'en-GB' } }),
}))
vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: object) => unknown) =>
    selector({ stripeEnabled: false }),
}))
vi.mock('@/store/freemium', () => ({
  useFreemiumStore: (selector: (state: object) => unknown) =>
    selector({
      status: null,
      fetchStatus: mocks.fetchFreemium,
      decrement: mocks.decrementFreemium,
    }),
}))
vi.mock('@/components/billing/MaintenanceBanner', () => ({
  MaintenanceGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/components/billing/PaywallBanner', () => ({
  PaywallBanner: () => null,
}))
vi.mock('@/components/billing/FreemiumQuotaBanner', () => ({
  FreemiumQuotaBanner: () => null,
}))
vi.mock('@/components/ui/AudioPlayer', () => ({ AudioPlayer: () => null }))
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
  }) => {
    if (!open) return null
    return (
      <div>
        <button onClick={onConfirm}>confirmDelete</button>
        <button onClick={onCancel}>cancelDelete</button>
      </div>
    )
  },
}))
vi.mock('@/components/ui/WordTooltip', () => ({
  WordTooltip: () => null,
  useWordSave: () => ({
    selectedWord: null,
    tooltipPos: null,
    saveState: 'idle',
    handleTextSelection: mocks.handleTextSelection,
    handleSaveWord: vi.fn(),
    dismissTooltip: mocks.dismissTooltip,
  }),
}))
vi.mock('@/components/ui/page-loading', () => ({ PageLoading: () => null }))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({
    children,
    as: Component = 'div',
    languageCode,
    reading,
    translation,
    ...props
  }: {
    children: ReactNode
    as?: ElementType
    languageCode?: string | null
    reading?: string | null
    translation?: string | null
  } & HTMLAttributes<HTMLElement>) => (
    <Component
      data-language-code={languageCode ?? undefined}
      data-reading={reading ?? undefined}
      data-translation={translation ?? undefined}
      {...props}
    >
      {children}
    </Component>
  ),
}))
vi.mock('@/components/AuthAvatarImage', () => ({
  AuthAvatarImage: () => null,
}))

import ChatPage from '@/app/(app)/chat/page'

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function chatStreamResponse(events: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          )
        }
        controller.close()
      },
    }),
    { status: 200 }
  )
}

function controlledChatStreamResponse() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController
      },
    }),
    { status: 200 }
  )

  return {
    response,
    enqueue(event: Record<string, unknown>) {
      if (!controller) throw new Error('Chat stream is not initialized')
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    },
    close() {
      if (!controller) throw new Error('Chat stream is not initialized')
      controller.close()
    },
  }
}

describe('chat memory stream', () => {
  let chatEvents: Array<Record<string, unknown>>
  let originalInnerWidth: number
  let originalScrollIntoViewDescriptor: PropertyDescriptor | undefined

  beforeAll(() => {
    originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollIntoView'
    )
  })

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    })
    sessionStorage.clear()
    mocks.push.mockReset()
    mocks.apiFetch.mockReset()
    mocks.fetchFreemium.mockReset()
    mocks.decrementFreemium.mockReset()
    mocks.dismissTooltip.mockReset()
    mocks.handleTextSelection.mockReset()
    Element.prototype.scrollIntoView = vi.fn()
    chatEvents = [
      { conversation_id: 7 },
      { token: 'Partial response.' },
      { response_reset: true },
      { token: 'Complete normal response.' },
      { done: true },
    ]
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat') {
        return Promise.resolve(chatStreamResponse(chatEvents))
      }
      return Promise.resolve(jsonResponse([]))
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    })
    sessionStorage.clear()
  })

  afterAll(() =>
    originalScrollIntoViewDescriptor
      ? Object.defineProperty(
          Element.prototype,
          'scrollIntoView',
          originalScrollIntoViewDescriptor
        )
      : Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  )

  it('opens the mobile sidebar with a separate native localized dismiss button', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    render(<ChatPage />)
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'close' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('toggleSidebarShow'))
    const close = screen.getByRole('button', { name: 'close' })
    const sidebar = screen.getByRole('complementary')
    expect(close.tagName).toBe('BUTTON')
    expect(close).toHaveAttribute('type', 'button')
    expect(close.tabIndex).toBe(0)
    expect(close.parentElement).toBe(sidebar.parentElement)
    expect(close).not.toContainElement(sidebar)
    expect(close).toHaveClass(
      'fixed',
      'inset-x-0',
      'top-14',
      'bottom-0',
      'z-10',
      'bg-black/40',
      'md:hidden'
    )

    fireEvent.click(close)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('toggleSidebarShow'))
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })

  it('ignores other keys and closes the open sidebar on Escape', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    render(<ChatPage />)
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    fireEvent.click(screen.getByTitle('toggleSidebarShow'))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: /newConversation/ }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it.each([768, 1024])(
    'keeps the desktop sidebar open on input Escape at width %i',
    async (width) => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
      })
      render(<ChatPage />)
      await screen.findByText('noConversation')
      const input = screen.getByPlaceholderText('placeholder')
      input.focus()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(input).toHaveFocus()
    }
  )

  it('checks the current breakpoint after resizing an open mobile sidebar', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 767,
    })
    render(<ChatPage />)
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
    fireEvent.click(screen.getByTitle('toggleSidebarShow'))
    const input = screen.getByPlaceholderText('placeholder')
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 768,
    })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 767,
    })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('registers Escape only while open and cleans up on hide and unmount', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    try {
      const { unmount } = render(<ChatPage />)
      await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled())
      const keydownCalls = () =>
        add.mock.calls.filter(([type]) => type === 'keydown')
      expect(keydownCalls()).toHaveLength(0)
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.click(screen.getByTitle('toggleSidebarShow'))
      expect(keydownCalls()).toHaveLength(1)
      const firstListener = keydownCalls()[0]![1]
      fireEvent.click(screen.getByTitle('toggleSidebarHide'))
      expect(remove).toHaveBeenCalledWith('keydown', firstListener)
      fireEvent.click(screen.getByTitle('toggleSidebarShow'))
      expect(keydownCalls()).toHaveLength(2)
      const secondListener = keydownCalls()[1]![1]
      unmount()
      expect(remove).toHaveBeenCalledWith('keydown', secondListener)
    } finally {
      add.mockRestore()
      remove.mockRestore()
    }
  })

  it('keeps the sidebar open for its delete control and preserves new-chat dismissal', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        jsonResponse(
          path === '/api/chat/conversations'
            ? [{ id: 7, title: 'Existing', source: 'text' }]
            : { messages: [{ role: 'assistant', content: 'Existing history' }] }
        )
      )
    )
    render(<ChatPage />)
    await screen.findByText('Existing history')
    fireEvent.click(screen.getByTitle('toggleSidebarShow'))
    const callsBeforeDelete = mocks.apiFetch.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }))
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'confirmDelete' })
    ).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledTimes(callsBeforeDelete)
    fireEvent.click(screen.getByRole('button', { name: /newConversation/ }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.queryByText('Existing history')).not.toBeInTheDocument()
  })

  it.each([390, 1024])(
    'selects a conversation through a native sibling action at width %i',
    async (width) => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
      })
      mocks.apiFetch.mockImplementation((path: string) => {
        if (path === '/api/chat/conversations') {
          return Promise.resolve(
            jsonResponse([
              { id: 7, title: 'Current', source: 'text' },
              { id: 3, title: 'Older voice', source: 'voice' },
            ])
          )
        }
        if (path === '/api/chat') {
          return Promise.resolve(chatStreamResponse([{ done: true }]))
        }
        return Promise.resolve(
          jsonResponse({
            messages: [
              {
                role: 'assistant',
                content:
                  path === '/api/chat/conversations/3/messages'
                    ? 'Selected history'
                    : 'Current history',
              },
            ],
          })
        )
      })
      render(<ChatPage />)
      await screen.findByText('Current history')
      if (width < 768) {
        fireEvent.click(screen.getByTitle('toggleSidebarShow'))
      }
      const sidebar = screen.getByRole('complementary')
      const primary = within(sidebar).getByRole('button', {
        name: /Older voice/,
      })
      const current = within(sidebar).getByRole('button', {
        name: 'Current',
      })
      const row = primary.parentElement!
      const remove = within(row).getByRole('button', {
        name: 'deleteConfirm',
      })
      expect(primary.tagName).toBe('BUTTON')
      expect(primary).toHaveAttribute('type', 'button')
      expect(primary).toHaveClass('focus-visible:outline-fl-fg')
      expect(primary.querySelector('button')).toBeNull()
      expect(remove.parentElement).toBe(row)
      expect(remove).toHaveAttribute('type', 'button')
      expect(remove.closest('button')).toBe(remove)
      expect(row.tagName).toBe('DIV')
      expect(row).not.toHaveAttribute('role')
      expect(row).not.toHaveAttribute('tabindex')
      expect(current.parentElement).toHaveClass('bg-fl-surface-2')
      expect(row).toHaveClass('border-l-transparent')
      expect(within(primary).getByTitle('voiceSession')).toBeInTheDocument()
      const callsBeforeSelection = mocks.apiFetch.mock.calls.length
      fireEvent.click(primary)
      const selectedHistory = await screen.findByText('Selected history')
      expect(selectedHistory).toBeInTheDocument()
      expect(screen.queryByText('Current history')).not.toBeInTheDocument()
      const selectionCalls =
        mocks.apiFetch.mock.calls.slice(callsBeforeSelection)
      const expectedPath = '/api/chat/conversations/3/messages'
      expect(selectionCalls).toEqual([[expectedPath]])
      expect(mocks.push).not.toHaveBeenCalled()
      if (width < 768) {
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      } else {
        expect(sidebar).toBeInTheDocument()
        expect(row).toHaveClass('bg-fl-surface-2', 'border-l-fl-fg')
        expect(current.parentElement).toHaveClass('border-l-transparent')
      }
      const input = screen.getByPlaceholderText('placeholder')
      fireEvent.change(input, { target: { value: 'Follow up' } })
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
      await waitFor(() =>
        expect(mocks.apiFetch).toHaveBeenCalledWith(
          '/api/chat',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              message: 'Follow up',
              conversation_id: 3,
            }),
          })
        )
      )
      await waitFor(() => expect(input).not.toBeDisabled())
    }
  )

  it('cancels and confirms inactive deletion without selecting its conversation', async () => {
    let deleted = false
    const respond = (path: string, options?: RequestInit) => {
      if (
        path === '/api/chat/conversations/3' &&
        options?.method === 'DELETE'
      ) {
        deleted = true
        return Promise.resolve(jsonResponse({}))
      }
      if (path === '/api/chat/conversations') {
        return Promise.resolve(
          jsonResponse([
            { id: 7, title: 'Current', source: 'text' },
            ...(!deleted ? [{ id: 3, title: 'Older', source: 'text' }] : []),
          ])
        )
      }
      return Promise.resolve(
        jsonResponse({
          messages: [{ role: 'assistant', content: 'Current history' }],
        })
      )
    }
    mocks.apiFetch.mockImplementation(respond)
    render(<ChatPage />)
    await screen.findByText('Current history')
    const primary = screen.getByRole('button', { name: 'Older' })
    const remove = within(primary.parentElement!).getByRole('button', {
      name: 'deleteConfirm',
    })
    const callsBeforeDelete = mocks.apiFetch.mock.calls.length
    fireEvent.click(remove)
    expect(mocks.apiFetch).toHaveBeenCalledTimes(callsBeforeDelete)
    expect(screen.getByText('Current history')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancelDelete' }))
    const confirmation = screen.queryByRole('button', {
      name: 'confirmDelete',
    })
    expect(confirmation).toBeNull()
    expect(primary).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledTimes(callsBeforeDelete)
    fireEvent.click(remove)
    fireEvent.click(screen.getByRole('button', { name: 'confirmDelete' }))
    await waitFor(() => expect(primary).not.toBeInTheDocument())
    expect(mocks.apiFetch.mock.calls.slice(callsBeforeDelete)).toEqual([
      ['/api/chat/conversations/3', { method: 'DELETE' }],
      ['/api/chat/conversations'],
    ])
    expect(screen.getByText('Current history')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })

  it('retries a failed conversation list and selects the newest conversation', async () => {
    const latest = { id: 9, title: 'Latest', source: 'text' }
    const older = { id: 4, title: 'Older', source: 'text' }
    let listCalls = 0
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat/conversations') {
        listCalls += 1
        return Promise.resolve(
          listCalls === 1
            ? new Response(null, { status: 503 })
            : jsonResponse([latest, older])
        )
      }
      if (path === '/api/chat/conversations/9/messages') {
        return Promise.resolve(
          jsonResponse({
            messages: [{ role: 'assistant', content: 'Newest history' }],
          })
        )
      }
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)

    expect(await screen.findByText('error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(await screen.findByText('Newest history')).toBeInTheDocument()
    expect(screen.getAllByText('Latest')).toHaveLength(2)
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/chat/conversations/9/messages'
    )
  })

  it('starts a new chat without creating a conversation and sends a null id', async () => {
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat/conversations') {
        return Promise.resolve(
          jsonResponse([{ id: 7, title: 'Existing', source: 'text' }])
        )
      }
      if (path === '/api/chat/conversations/7/messages') {
        return Promise.resolve(
          jsonResponse({
            messages: [{ role: 'assistant', content: 'Old message' }],
          })
        )
      }
      if (path === '/api/chat') {
        return Promise.resolve(chatStreamResponse([{ done: true }]))
      }
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)
    await screen.findByText('Old message')

    fireEvent.click(screen.getByRole('button', { name: /newConversation/ }))
    expect(screen.queryByText('Old message')).not.toBeInTheDocument()
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      '/api/chat/conversations',
      expect.objectContaining({ method: 'POST' })
    )
    const input = screen.getByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Start fresh' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message: 'Start fresh',
            conversation_id: null,
          }),
        })
      )
    )
  })

  it('deletes the active conversation and selects the next available one', async () => {
    let listCalls = 0
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat/conversations') {
        listCalls += 1
        return Promise.resolve(
          jsonResponse(
            listCalls === 1
              ? [
                  { id: 7, title: 'Current', source: 'text' },
                  { id: 3, title: 'Next', source: 'text' },
                ]
              : [{ id: 3, title: 'Next', source: 'text' }]
          )
        )
      }
      if (path === '/api/chat/conversations/7/messages') {
        return Promise.resolve(
          jsonResponse({
            messages: [{ role: 'assistant', content: 'Current history' }],
          })
        )
      }
      if (path === '/api/chat/conversations/3/messages') {
        return Promise.resolve(
          jsonResponse({
            messages: [{ role: 'assistant', content: 'Next history' }],
          })
        )
      }
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)
    await screen.findByText('Current history')
    fireEvent.click(
      screen.getAllByRole('button', { name: 'deleteConfirm' })[0]!
    )
    fireEvent.click(screen.getByRole('button', { name: 'confirmDelete' }))

    expect(await screen.findByText('Next history')).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/chat/conversations/7', {
      method: 'DELETE',
    })
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/chat/conversations/3/messages'
    )
  })

  it('passes only the last 20 nonblank messages to voice and navigates', async () => {
    const messages = [
      ...Array.from({ length: 21 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `message ${index}`,
      })),
      { role: 'assistant', content: '   ' },
    ]
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat/conversations') {
        return Promise.resolve(
          jsonResponse([{ id: 7, title: 'History', source: 'text' }])
        )
      }
      if (path === '/api/chat/conversations/7/messages') {
        return Promise.resolve(jsonResponse({ messages }))
      }
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)
    await screen.findByText('message 20')
    fireEvent.click(screen.getByRole('button', { name: 'continueInVoice' }))

    expect(JSON.parse(sessionStorage.getItem('voice_context') ?? '{}')).toEqual(
      {
        messages: messages.slice(1, 21),
      }
    )
    expect(mocks.push).toHaveBeenCalledWith('/conversation')
    expect(
      JSON.parse(sessionStorage.getItem('voice_context') ?? '{}')
    ).not.toHaveProperty('conversation_id')
  })

  it('allocates each duplicate record once and keeps its DOM through tokens, reset and done', async () => {
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID')
    const stream = controlledChatStreamResponse()
    const history = [
      { role: 'user', content: 'Same' },
      { role: 'assistant', content: 'Same' },
      { role: 'user', content: 'Same' },
      { role: 'assistant', content: 'Same' },
    ]
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat') return Promise.resolve(stream.response)
      if (path === '/api/chat/conversations') {
        return Promise.resolve(
          jsonResponse([{ id: 7, title: 'History', source: 'text' }])
        )
      }
      return Promise.resolve(jsonResponse({ messages: history }))
    })
    try {
      render(<ChatPage />)
      const originals = await screen.findAllByText('Same')
      expect(originals).toHaveLength(4)
      const input = screen.getByPlaceholderText('placeholder')
      fireEvent.change(input, { target: { value: 'Same' } })
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
      await act(async () => {
        stream.enqueue({ token: 'Same' })
      })
      const duplicates = await screen.findAllByText('Same')
      expect(duplicates).toHaveLength(6)
      const assistant = duplicates[5]!
      const row = assistant.parentElement!.parentElement!
      await act(async () => {
        stream.enqueue({ token: ' token' })
      })
      expect(screen.getByText('Same token')).toBe(assistant)
      await act(async () => {
        stream.enqueue({ response_reset: true })
      })
      expect(row).toBeInTheDocument()
      expect(assistant).toContainHTML('▌')
      await act(async () => {
        stream.enqueue({ token: 'Same' })
        stream.enqueue({ memory_updated: true })
        stream.enqueue({ done: true })
        stream.close()
      })
      await waitFor(() => expect(input).not.toBeDisabled())
      expect(screen.getAllByText('Same')).toEqual(duplicates)
      expect(row).toBeInTheDocument()
      expect(screen.getByText('memorySavedToast')).toBeInTheDocument()
      fireEvent.pointerUp(assistant)
      expect(mocks.handleTextSelection).toHaveBeenCalledWith('Same')
      fireEvent.click(screen.getByRole('button', { name: 'continueInVoice' }))
      expect(
        JSON.parse(sessionStorage.getItem('voice_context') ?? '{}')
      ).toEqual({
        messages: [
          ...history,
          { role: 'user', content: 'Same' },
          { role: 'assistant', content: 'Same' },
        ],
      })
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Same', conversation_id: 7 }),
      })
      expect(uuid).toHaveBeenCalledTimes(6)
    } finally {
      uuid.mockRestore()
    }
  })

  it('replaces a partial incompatible-tools response with the complete fallback', async () => {
    const stream = controlledChatStreamResponse()
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat') return Promise.resolve(stream.response)
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)

    const input = await screen.findByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await act(async () => {
      stream.enqueue({ conversation_id: 7 })
      stream.enqueue({ token: 'Partial response.' })
    })
    expect(await screen.findByText('Partial response.')).toBeInTheDocument()

    await act(async () => {
      stream.enqueue({ response_reset: true })
    })
    await waitFor(() =>
      expect(screen.queryByText('Partial response.')).not.toBeInTheDocument()
    )

    await act(async () => {
      stream.enqueue({ token: 'Complete normal response.' })
      stream.enqueue({ done: true })
      stream.close()
    })
    expect(
      await screen.findByText('Complete normal response.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Partial response.')).not.toBeInTheDocument()
    expect(screen.queryByText('memorySavedToast')).not.toBeInTheDocument()
    expect(mocks.dismissTooltip).toHaveBeenCalled()
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.anything()
      )
    )
  })

  it('enables assistant word selection only after streaming completes', async () => {
    const stream = controlledChatStreamResponse()
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/chat') return Promise.resolve(stream.response)
      return Promise.resolve(jsonResponse([]))
    })
    render(<ChatPage />)

    const input = await screen.findByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await act(async () => {
      stream.enqueue({ conversation_id: 7 })
      stream.enqueue({ token: 'Streaming response.' })
    })
    const response = await screen.findByText('Streaming response.')
    fireEvent.pointerUp(response)
    expect(mocks.handleTextSelection).not.toHaveBeenCalled()

    await act(async () => {
      stream.enqueue({ done: true })
      stream.close()
    })
    await waitFor(() => expect(input).not.toBeDisabled())
    fireEvent.pointerUp(response)
    expect(mocks.handleTextSelection).toHaveBeenCalledWith(
      'Streaming response.'
    )
  })

  it('shows the toast only after the backend confirms a saved memory', async () => {
    chatEvents = [
      { conversation_id: 7 },
      { token: 'Normal response.' },
      { memory_updated: true },
      { done: true },
    ]
    render(<ChatPage />)

    const input = await screen.findByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Remember this' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(await screen.findByText('Normal response.')).toBeInTheDocument()
    expect(await screen.findByText('memorySavedToast')).toBeInTheDocument()
  })

  it('keeps the confirmed memory toast when a later stream error arrives', async () => {
    chatEvents = [
      { conversation_id: 7 },
      { memory_updated: true },
      { error: 'Something went wrong.' },
    ]
    render(<ChatPage />)

    const input = await screen.findByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'Remember this' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(await screen.findByText('memorySavedToast')).toBeInTheDocument()
    expect(await screen.findByText(/errorMessage/)).toBeInTheDocument()
  })

  it.each([
    [429, 'Monthly token limit reached (10/10 tokens).', 'quotaExceededTokens'],
    [429, 'Rate limit exceeded: 30 per 1 minute', 'errorMessage'],
    [502, 'Provider unavailable', 'errorMessage'],
  ])(
    'localizes HTTP %i errors instead of showing backend details',
    async (status, detail, label) => {
      mocks.apiFetch.mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/chat'
            ? new Response(JSON.stringify({ detail }), {
                status,
                headers: { 'Content-Type': 'application/json' },
              })
            : jsonResponse([])
        )
      )
      render(<ChatPage />)

      const input = await screen.findByPlaceholderText('placeholder')
      fireEvent.change(input, { target: { value: 'Hello' } })
      fireEvent.click(screen.getByRole('button', { name: 'send' }))

      expect(await screen.findByText(new RegExp(label))).toBeInTheDocument()
      expect(screen.queryByText(detail)).toBeNull()
    }
  )
})
