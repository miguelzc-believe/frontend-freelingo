import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ListeningExercise } from '@/types/api'

const {
  mockApiFetch,
  mockFetchStatus,
  mockDecrement,
  mockTranslate,
  mockDismissTooltip,
} = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockFetchStatus: vi.fn().mockResolvedValue(undefined),
  mockDecrement: vi.fn(),
  mockTranslate: (key: string) => key,
  mockDismissTooltip: vi.fn(),
}))

// Stable reference: the page's load effect depends on `t`.
vi.mock('use-intl', () => ({ useTranslations: () => mockTranslate }))
vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label }: { label?: string }) => (
    <div>{label ?? 'loading'}</div>
  ),
}))
vi.mock('@/components/ui/WordTooltip', () => ({
  WordTooltip: () => null,
  useWordSave: () => ({
    selectedWord: null,
    tooltipPos: null,
    saveState: 'idle',
    handleTextSelection: vi.fn(),
    handleSaveWord: vi.fn(),
    dismissTooltip: mockDismissTooltip,
  }),
}))
vi.mock('@/components/billing/FreemiumQuotaBanner', () => ({
  FreemiumQuotaBanner: () => null,
}))
vi.mock('@/components/billing/PaywallBanner', () => ({
  PaywallBanner: ({ feature }: { feature: string }) => (
    <div data-testid="paywall">{feature}</div>
  ),
}))
vi.mock('@/components/billing/MaintenanceBanner', () => ({
  MaintenanceGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/pagination', () => ({ Pagination: () => null }))
vi.mock('@/components/ui/exercise-audio-player', () => ({
  ExerciseAudioPlayer: ({ exerciseId }: { exerciseId: number }) => (
    <div data-testid="audio-player">{exerciseId}</div>
  ),
}))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: () => null,
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowExerciseReviewPrompt: () => true,
}))

import ListeningPage from '@/app/(app)/listening/page'
import { useAuthStore, type User } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useFreemiumStore } from '@/store/freemium'
import { useLanguageStore } from '@/store/language'
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

const exercise: ListeningExercise = {
  id: 12,
  level: 'B1',
  target_language: 'de',
  exercise_type: 'mcq',
  topic: 'Am Bahnhof',
  duration_seconds: 42,
  questions: [
    {
      index: 0,
      question: 'Wohin fährt der Zug?',
      options: { a: 'Nach Berlin', b: 'Nach Bonn' },
    },
    {
      index: 1,
      question: 'Wann fährt er?',
      options: { a: 'Um neun', b: 'Um zehn' },
    },
  ],
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface ApiOptions {
  next?: unknown
  nextStatus?: number
  nextRejects?: boolean
  attempt?: unknown
  attemptStatus?: number
  history?: unknown
  historyRejects?: boolean
}

function mockApi({
  next = { available: true, exercise },
  nextStatus = 200,
  nextRejects = false,
  attempt = {
    score: 2,
    xp_earned: 12,
    text: 'Der Zug fährt um zehn Uhr ab.',
    correct_answers: [
      { index: 0, correct: 'a' },
      { index: 1, correct: 'b' },
    ],
  },
  attemptStatus = 200,
  history = { items: [], total: 0 },
  historyRejects = false,
}: ApiOptions = {}) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/listening/history?')) {
      if (historyRejects) throw new Error('history unavailable')
      return jsonResponse(history)
    }
    if (url === '/api/listening/next') {
      if (nextRejects) throw new Error('network down')
      return jsonResponse(next, nextStatus)
    }
    if (url === '/api/listening/attempt')
      return jsonResponse(attempt, attemptStatus)
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

function optionLabel(index: number, key: string) {
  const q = exercise.questions[index]
  if (!q) throw new Error(`Missing question at index ${index}`)
  const label = `${key}. ${q.options[key]}`.replace(/\./g, '\\.')
  return new RegExp(label)
}

function attemptBody() {
  const call = mockApiFetch.mock.calls.find(
    ([url]) => url === '/api/listening/attempt'
  )
  return JSON.parse((call?.[1] as { body: string }).body) as {
    exercise_id: number
    answers: Record<string, string>
    replay: boolean
  }
}

async function answerExercise(picks: string[]) {
  exercise.questions.forEach((_, index) => {
    fireEvent.click(
      screen.getByRole('button', {
        name: optionLabel(index, picks[index] ?? ''),
      })
    )
  })
  const submit = screen.getByRole('button', { name: 'submit' })
  await waitFor(() => expect(submit).toBeEnabled())
  fireEvent.click(submit)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: 'token', user: null })
  useConfigStore.setState({ stripeEnabled: false, maintenanceMode: false })
  useLanguageStore.setState({ activeLanguage: german })
  useFreemiumStore.setState({
    status: null,
    loaded: false,
    fetchStatus: mockFetchStatus,
    decrement: mockDecrement,
  })
})

describe('ListeningPage', () => {
  it('loads an available exercise and renders its audio player', async () => {
    mockApi()
    render(<ListeningPage />)

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('Am Bahnhof')).toBeInTheDocument()
    expect(screen.getByText('B1 · mcq')).toBeInTheDocument()
    expect(screen.getByTestId('audio-player')).toHaveTextContent('12')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/listening/next')
  })

  it('loads and shows an empty history with the first-page API contract', async () => {
    mockApi()
    render(<ListeningPage />)

    await screen.findByText('Am Bahnhof')
    fireEvent.click(screen.getByRole('button', { name: 'history' }))

    expect(await screen.findByText('historyEmpty')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/listening/history?skip=0&limit=10'
    )
    expect(screen.queryByText('next')).not.toBeInTheDocument()
    expect(screen.queryByText('back')).not.toBeInTheDocument()
  })

  it('shows populated history details and replays without XP', async () => {
    mockApi({
      history: {
        items: [
          {
            id: 91,
            score: 1,
            xp_earned: 8,
            completed_at: '2025-01-01T00:00:00Z',
            exercise,
            text: 'Der Zug fährt um zehn Uhr ab.',
            answers: { '0': 'a' },
          },
        ],
        total: 1,
      },
    })
    render(<ListeningPage />)

    await screen.findByText('Am Bahnhof')
    fireEvent.click(screen.getByRole('button', { name: 'history' }))
    expect(
      await screen.findByText('Der Zug fährt um zehn Uhr ab.')
    ).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('+8 XP')).toBeInTheDocument()
  })

  it('submits a replay attempt with no XP reward', async () => {
    mockApi({
      history: {
        items: [
          {
            id: 91,
            score: 1,
            xp_earned: 8,
            completed_at: '2025-01-01T00:00:00Z',
            exercise,
            text: 'Der Zug fährt um zehn Uhr ab.',
            answers: { '0': 'a' },
          },
        ],
        total: 1,
      },
    })
    render(<ListeningPage />)

    await screen.findByText('Am Bahnhof')
    fireEvent.click(screen.getByRole('button', { name: 'history' }))
    await screen.findByText('Der Zug fährt um zehn Uhr ab.')
    fireEvent.click(screen.getByRole('button', { name: 'practiceAgain' }))
    await screen.findByTestId('audio-player')
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('replayNoXp')).toBeInTheDocument()
    expect(screen.queryByText('+12')).not.toBeInTheDocument()
    expect(attemptBody()).toEqual({
      exercise_id: 12,
      answers: { '0': 'a', '1': 'b' },
      replay: true,
    })
  })

  it('treats a failed history request as an empty history', async () => {
    mockApi({ historyRejects: true })
    render(<ListeningPage />)

    await screen.findByText('Am Bahnhof')
    fireEvent.click(screen.getByRole('button', { name: 'history' }))

    expect(await screen.findByText('historyEmpty')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/listening/history?skip=0&limit=10'
    )
  })

  it('reports a rejected exercise request', async () => {
    mockApi({ nextRejects: true })
    render(<ListeningPage />)

    expect(await screen.findByText('errorLoading')).toBeInTheDocument()
    expect(screen.getByText('noExercises')).toBeInTheDocument()
  })

  it('shows the empty state when the server has no available exercise', async () => {
    mockApi({ next: { available: false } })
    render(<ListeningPage />)

    expect(await screen.findByText('noExercises')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
  })

  it('does not show the network error for a non-success next response', async () => {
    mockApi({ nextStatus: 500 })
    render(<ListeningPage />)

    expect(await screen.findByText('noExercises')).toBeInTheDocument()
    expect(screen.queryByText('errorLoading')).not.toBeInTheDocument()
  })

  it('keeps submit disabled until each answer is selected', async () => {
    mockApi()
    render(<ListeningPage />)

    const submit = await screen.findByRole('button', { name: 'submit' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: optionLabel(0, 'a') }))
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: optionLabel(1, 'b') }))
    expect(submit).toBeEnabled()
  })

  it('submits answers, displays the transcript and results, then loads the next exercise', async () => {
    let nextCall = 0
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next') {
        nextCall += 1
        return jsonResponse({
          available: true,
          exercise:
            nextCall === 1
              ? exercise
              : { ...exercise, id: 13, topic: 'Die Reise' },
        })
      }
      if (url === '/api/listening/attempt') {
        return jsonResponse({
          score: 2,
          xp_earned: 12,
          text: 'Der Zug fährt um zehn Uhr ab.',
          correct_answers: [
            { index: 0, correct: 'a' },
            { index: 1, correct: 'b' },
          ],
        })
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('resultsLabel')).toBeInTheDocument()
    expect(
      screen.getByText('Der Zug fährt um zehn Uhr ab.')
    ).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(attemptBody()).toMatchObject({
      exercise_id: 12,
      answers: { '0': 'a', '1': 'b' },
      replay: false,
    })

    fireEvent.click(screen.getByRole('button', { name: 'nextExercise' }))
    expect(await screen.findByText('Die Reise')).toBeInTheDocument()
  })

  it('shows an error and keeps the exercise when submitting is rejected', async () => {
    mockApi({ attempt: { detail: 'already_attempted' }, attemptStatus: 400 })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('alreadyAttempted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument()
    expect(screen.queryByText('resultsLabel')).not.toBeInTheDocument()
  })

  it('fetches and decrements the free listening quota after an attempt', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    mockApi()
    render(<ListeningPage />)

    expect(mockFetchStatus).toHaveBeenCalled()
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])
    await screen.findByText('resultsLabel')
    await waitFor(() =>
      expect(mockDecrement).toHaveBeenCalledWith('listening_remaining')
    )
  })

  it('blocks listening exercises after the free quota is exhausted', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    useFreemiumStore.setState({
      status: { listening_remaining: 0, listening_limit: 3 } as never,
    })
    mockApi()
    render(<ListeningPage />)

    expect(await screen.findByTestId('paywall')).toHaveTextContent('listening')
    expect(screen.queryByTestId('audio-player')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'submit' })
    ).not.toBeInTheDocument()
  })
})
