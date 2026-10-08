import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

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

function propsSince(callCount: number): Record<string, unknown>[] {
  return mockConversationMode.mock.calls
    .slice(callCount)
    .map(([props]) => props as Record<string, unknown>)
}

function deferredPlan() {
  let resolve: ((response: Response) => void) | undefined
  const promise = new Promise<Response>((finish) => {
    resolve = finish
  })
  return { promise, resolve: (data: unknown) => resolve?.(jsonResponse(data)) }
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

  it.each([
    {
      payload: [{ role: 'assistant', content: 'Continue' }],
      messages: [{ role: 'assistant', content: 'Continue' }],
    },
    { payload: { messages: [] }, messages: [] },
    { payload: { messages: 'not an array' }, messages: undefined },
  ])(
    'preserves legacy and packaged voice context semantics for $payload',
    async ({ payload, messages }) => {
      mockToday()
      sessionStorage.setItem('voice_context', JSON.stringify(payload))
      render(<ConversationPage />)
      expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
      expect(lastProps()).toMatchObject({
        initialContext: messages,
        autoStart: true,
      })
      expect(sessionStorage.getItem('voice_context')).toBeNull()
    }
  )

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

  it('retains the consumed trial and context during StrictMode effect replay', async () => {
    mockToday()
    sessionStorage.setItem(
      'assessment_voice_trial',
      JSON.stringify({
        token: 'strict-trial',
        durationSeconds: 240,
        cefrLevel: 'A2',
        targetLanguage: 'fr-FR',
      })
    )
    render(
      <StrictMode>
        <ConversationPage />
      </StrictMode>
    )
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      voiceTrialToken: 'strict-trial',
      autoStart: true,
      trialMode: true,
      targetLanguage: 'fr-FR',
      cefrLevel: 'A2',
    })
    expect(sessionStorage.getItem('assessment_voice_trial')).toBeNull()
    expect(mockApiFetch.mock.calls[0]?.[1]?.signal.aborted).toBe(true)
  })

  it('retains consumed text context during StrictMode effect replay', async () => {
    mockToday()
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify({
        messages: [{ role: 'assistant', content: 'Continue our topic' }],
      })
    )
    render(
      <StrictMode>
        <ConversationPage />
      </StrictMode>
    )
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      autoStart: true,
      initialContext: [{ role: 'assistant', content: 'Continue our topic' }],
    })
    expect(sessionStorage.getItem('voice_context')).toBeNull()
  })

  it('prioritizes a trial over exhausted quota and defaults invalid optional fields', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    useFreemiumStore.setState({
      status: { voice_remaining_seconds: 0, voice_limit_seconds: 600 } as never,
    })
    mockToday()
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify([{ role: 'user', content: 'Old topic' }])
    )
    sessionStorage.setItem(
      'assessment_voice_trial',
      JSON.stringify({
        token: 'trial-token',
        durationSeconds: '240',
        cefrLevel: 2,
        targetLanguage: false,
      })
    )
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      voiceTrialDurationSeconds: 300,
      cefrLevel: 'B1',
      targetLanguage: 'de',
      trialMode: true,
      autoStart: true,
      initialContext: [
        {
          role: 'user',
          content:
            'I just completed the placement assessment. Please start a short, friendly voice conversation adapted to my level.',
        },
      ],
    })
    expect(screen.queryByText('freeLimit')).toBeNull()
    expect(sessionStorage.getItem('voice_context')).toBeNull()
    expect(sessionStorage.getItem('assessment_voice_trial')).toBeNull()
  })

  it.each(['null', '{bad json', '[]'])(
    'ignores malformed trial storage %s',
    async (raw) => {
      mockToday()
      sessionStorage.setItem('assessment_voice_trial', raw)
      render(<ConversationPage />)
      expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
      expect(lastProps()).toMatchObject({ autoStart: false })
      expect(lastProps()).not.toHaveProperty('voiceTrialToken')
      expect(sessionStorage.getItem('assessment_voice_trial')).toBeNull()
    }
  )

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

  it('does not deliver an old language handoff or readiness during a deferred plan fetch', async () => {
    mockToday('B1')
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify([{ role: 'user', content: 'German topic' }])
    )
    render(<ConversationPage />)
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      targetLanguage: 'de',
      initialContext: [{ role: 'user', content: 'German topic' }],
      autoStart: true,
    })

    const nextPlan = deferredPlan()
    mockApiFetch.mockImplementationOnce(() => nextPlan.promise)
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify([{ role: 'user', content: 'French topic' }])
    )
    const callCount = mockConversationMode.mock.calls.length
    act(() =>
      useLanguageStore.setState({
        activeLanguage: { ...german, code: 'fr-FR' },
      })
    )
    expect(mockApiFetch).toHaveBeenCalledTimes(2)
    expect(propsSince(callCount)).toEqual([])
    expect(screen.queryByTestId('conversation-mode')).toBeNull()
    expect(sessionStorage.getItem('voice_context')).toBeNull()

    await act(async () => nextPlan.resolve({ cefr_level: 'A1' }))
    const newProps = propsSince(callCount)
    expect(newProps.length).toBeGreaterThan(0)
    for (const props of newProps) {
      expect(props).toMatchObject({
        targetLanguage: 'fr-FR',
        cefrLevel: 'A1',
        initialContext: [{ role: 'user', content: 'French topic' }],
        autoStart: true,
      })
      expect(props).not.toHaveProperty('voiceTrialToken')
    }
  })

  it('does not deliver a previous account trial when the user changes on the same language', async () => {
    useAuthStore.setState({ user: freeUser })
    mockToday('B1')
    sessionStorage.setItem(
      'assessment_voice_trial',
      JSON.stringify({
        token: 'first-account-trial',
        durationSeconds: 240,
        cefrLevel: 'A2',
        targetLanguage: 'fr-FR',
      })
    )
    render(
      <StrictMode>
        <ConversationPage />
      </StrictMode>
    )
    expect(await screen.findByTestId('conversation-mode')).toBeInTheDocument()
    expect(lastProps()).toMatchObject({
      voiceTrialToken: 'first-account-trial',
      trialMode: true,
      autoStart: true,
    })

    const nextPlan = deferredPlan()
    mockApiFetch.mockImplementationOnce(() => nextPlan.promise)
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify([{ role: 'user', content: 'Second account topic' }])
    )
    const callCount = mockConversationMode.mock.calls.length
    act(() => useAuthStore.setState({ user: { ...freeUser, id: 2 } }))
    expect(mockApiFetch).toHaveBeenCalledTimes(3) // StrictMode replay + new owner
    expect(propsSince(callCount)).toEqual([])
    expect(screen.queryByTestId('conversation-mode')).toBeNull()
    expect(sessionStorage.getItem('voice_context')).toBeNull()

    await act(async () => nextPlan.resolve({ cefr_level: 'C1' }))
    const newProps = propsSince(callCount)
    expect(newProps.length).toBeGreaterThan(0)
    for (const props of newProps) {
      expect(props).toMatchObject({
        targetLanguage: 'de',
        cefrLevel: 'C1',
        initialContext: [{ role: 'user', content: 'Second account topic' }],
        autoStart: true,
      })
      expect(props).not.toHaveProperty('voiceTrialToken')
      expect(props).not.toHaveProperty('trialMode')
    }
  })

  it('clears the previous language context and ignores its late plan response', async () => {
    const oldPlan = deferredPlan()
    mockApiFetch.mockImplementationOnce(() => oldPlan.promise)
    mockApiFetch.mockResolvedValue(jsonResponse({ cefr_level: 'A1' }))
    sessionStorage.setItem(
      'voice_context',
      JSON.stringify([{ role: 'user', content: 'Old language topic' }])
    )
    render(<ConversationPage />)
    const oldSignal = mockApiFetch.mock.calls[0]?.[1]?.signal as AbortSignal
    const callCount = mockConversationMode.mock.calls.length
    act(() =>
      useLanguageStore.setState({
        activeLanguage: { ...german, code: 'fr-FR' },
      })
    )
    expect(oldSignal.aborted).toBe(true)
    await waitFor(() => expect(propsSince(callCount).length).toBeGreaterThan(0))
    for (const props of propsSince(callCount)) {
      expect(props).toMatchObject({
        targetLanguage: 'fr-FR',
        cefrLevel: 'A1',
        autoStart: false,
        initialContext: undefined,
      })
      expect(props).not.toHaveProperty('voiceTrialToken')
    }
    await act(async () => oldPlan.resolve({ cefr_level: 'C2' }))
    for (const props of propsSince(callCount)) {
      expect(props).toMatchObject({
        targetLanguage: 'fr-FR',
        cefrLevel: 'A1',
        autoStart: false,
        initialContext: undefined,
      })
      expect(props).not.toHaveProperty('voiceTrialToken')
    }
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
