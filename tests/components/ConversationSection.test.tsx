import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/lib/mappers', () => ({
  mapUser: (
    data: Record<string, unknown>,
    current: Record<string, unknown>
  ) => ({
    ...current,
    ...data,
  }),
}))

import { ConversationSection } from '@/components/settings/ConversationSection'
import { useAuthStore } from '@/store/auth'

const defaultUser = {
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  role: 'user' as const,
  conversation_max_duration: 1800,
  conversation_inactivity_timeout: 180,
  conversation_speech_pause: 2000,
}

function savedBody() {
  return JSON.parse(mockApiFetch.mock.calls[0]![1].body)
}

describe('ConversationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockReset()
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => defaultUser })
    useAuthStore.setState({
      accessToken: 'test-token',
      user: { ...defaultUser },
    })
  })

  it('offers session limits but no automatic end-of-turn pause', () => {
    render(<ConversationSection />)
    expect(screen.getByText('conversationDescription')).toBeInTheDocument()
    expect(screen.getByText('conversationMaxDuration')).toBeInTheDocument()
    expect(
      screen.getByText('conversationInactivityTimeout')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('conversationSpeechPause')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('speechPauseAuto')).not.toBeInTheDocument()
  })

  it('saves selected duration and inactivity without sending obsolete VAD preferences', async () => {
    render(<ConversationSection />)
    fireEvent.click(screen.getByText('min15'))
    fireEvent.click(screen.getByText('min5'))
    fireEvent.click(screen.getByText('saveConversation'))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    expect(savedBody()).toEqual({
      conversation_max_duration: 900,
      conversation_inactivity_timeout: 300,
    })
    expect(screen.getByText('✓ conversationSaved')).toBeInTheDocument()
  })

  it('reports failed saves and enables retry', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false })
    render(<ConversationSection />)
    fireEvent.click(screen.getByText('saveConversation'))
    expect(await screen.findByText('✕ saveFailed')).toBeInTheDocument()
    expect(screen.getByText('saveConversation')).not.toBeDisabled()
  })
})
