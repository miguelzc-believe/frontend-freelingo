import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockApiFetch, mockConversationMode } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockConversationMode: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))

vi.mock('@/components/conversation/ConversationMode', () => ({
  default: (props: Record<string, unknown>) => {
    mockConversationMode(props)
    return <div data-testid="conversation-mode" />
  },
}))

import ConversationPage from '@/app/(app)/conversation/page'
import { useAuthStore, type User } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useLanguageStore } from '@/store/language'
import { useFreemiumStore } from '@/store/freemium'
import type { TargetLanguage } from '@/lib/target-languages'

const german: TargetLanguage = {
  code: 'de',
  name: 'Deutsch',
  nameEn: 'German',
  flagPath: '/flags/de.svg',
  iso639: 'de',
  script: 'latin',
  fontClass: '',
  usesWordSpacing: true,
}

const freeUser: User = {
  id: 1,
  username: 'Student',
  displayName: 'Student',
  role: 'user',
  conversation_max_duration: 900,
  conversation_inactivity_timeout: 300,
  subscription_status: 'none',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockToday(cefrLevel: unknown = 'B1', status = 200) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url === '/api/study-plan/today')
      return status === 200
        ? jsonResponse({ cefr_level: cefrLevel })
        : jsonResponse({}, status)
    if (url === '/api/freemium/status')
      return jsonResponse({
        voice_remaining_seconds: 120,
        voice_limit_seconds: 600,
      })
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

function lastProps() {
  return mockConversationMode.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  useAuthStore.setState({ accessToken: 'token', user: null })
  useConfigStore.setState({ stripeEnabled: false, maintenanceMode: false })
  useLanguageStore.setState({ activeLanguage: german })
  useFreemiumStore.setState({
    status: null,
    loaded: false,
    fetchStatus: vi.fn().mockResolvedValue(undefined),
  })
})

describe('ConversationPage', () => {
  it('waits for the study plan and renders the conversation for the target language', async () => {
    mockToday()
    render(<ConversationPage />)
    expect(mockConversationMode).not.toHaveBeenCalled()
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      cefrLevel: 'B1',
      targetLanguage: 'de',
      autoStart: false,
    })
  })

  it('still renders the conversation when the study plan request fails', async () => {
    mockToday(null, 500)
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({ cefrLevel: null })
  })

  it('starts from the pending voice context and clears it', async () => {
    mockToday()
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] })
    )
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      initialContext: [{ role: 'user', content: 'Hello' }],
      autoStart: true,
    })
    expect(sessionStorage.getItem('voice_context')).toBeNull()
  })

  it('ignores a malformed voice context payload', async () => {
    mockToday()
    sessionStorage.setItem('voice_context', '{not json')
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({ autoStart: false })
    expect(sessionStorage.getItem('voice_context')).toBeNull()
  })

  it('hands the assessment voice trial to the conversation', async () => {
    mockToday()
    sessionStorage.setItem(
      'assessment_voice_trial',
      JSON.stringify({
        token: 'trial-token',
        durationSeconds: 240,
        cefrLevel: 'A2',
        targetLanguage: 'fr',
      })
    )
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      voiceTrialToken: 'trial-token',
      voiceTrialDurationSeconds: 240,
      cefrLevel: 'A2',
      targetLanguage: 'fr',
      trialMode: true,
      autoStart: true,
    })
    expect(sessionStorage.getItem('assessment_voice_trial')).toBeNull()
  })

  it('drops a voice trial without a token and keeps the default level', async () => {
    mockToday()
    sessionStorage.setItem(
      'assessment_voice_trial',
      JSON.stringify({ token: '' })
    )
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({ cefrLevel: 'B1' })
    expect(lastProps()).not.toHaveProperty('voiceTrialToken')
    expect(sessionStorage.getItem('assessment_voice_trial')).toBeNull()
  })

  it('fetches the freemium status and shows the remaining voice minutes', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    mockToday()
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(useFreemiumStore.getState().fetchStatus).toHaveBeenCalled()
    useFreemiumStore.setState({
      status: {
        voice_remaining_seconds: 1800,
        voice_limit_seconds: 3600,
      } as never,
    })
    await waitFor(() =>
      expect(lastProps()).toMatchObject({
        freemiumVoiceRemaining: 30,
        freemiumVoiceLimit: 60,
      })
    )
  })

  it('blocks the conversation and shows the paywall when the quota is spent', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    useFreemiumStore.setState({
      status: {
        voice_remaining_seconds: 0,
        voice_limit_seconds: 3600,
      } as never,
    })
    mockToday()
    render(<ConversationPage />)
    expect(await screen.findByText('freeLimit')).toBeInTheDocument()
    expect(mockConversationMode).not.toHaveBeenCalled()
  })
})
