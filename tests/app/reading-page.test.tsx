import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ReadingExercise } from '@/types/api'

const {
  mockApiFetch,
  mockFetchStatus,
  mockDecrement,
  mockReviewPrompt,
  mockTranslate,
  mockDismissTooltip,
} = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockFetchStatus: vi.fn().mockResolvedValue(undefined),
  mockDecrement: vi.fn(),
  mockReviewPrompt: vi.fn(),
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
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: ({ open }: { open: boolean }) => {
    mockReviewPrompt(open)
    return null
  },
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowExerciseReviewPrompt: () => true,
}))

import ReadingPage from '@/app/(app)/reading/page'
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

const exercise: ReadingExercise = {
  id: 7,
  level: 'B1',
  target_language: 'de',
  exercise_type: 'mcq',
  topic: 'Stadt',
  text: 'Der Markt ist heute geschlossen.',
  questions: [
    {
      index: 0,
      question: 'Was ist geschlossen?',
      options: { a: 'Der Markt', b: 'Der Bahnhof' },
    },
    {
      index: 1,
      question: 'Wann?',
      options: { a: 'Heute', b: 'Morgen' },
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
  generateStatus?: number
  generateDetail?: string
}

function mockApi({
  next = { available: true, exercise },
  nextStatus = 200,
  nextRejects = false,
  attempt = {
    score: 1,
    xp_earned: 10,
    correct_answers: [
      { index: 0, correct: 'a' },
      { index: 1, correct: 'b' },
    ],
  },
  attemptStatus = 200,
  generateStatus = 202,
  generateDetail,
}: ApiOptions = {}) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url === '/api/reading/next') {
      if (nextRejects) throw new Error('network down')
      return jsonResponse(next, nextStatus)
    }
    if (url === '/api/reading/generate') {
      return generateDetail
        ? jsonResponse({ detail: generateDetail }, generateStatus)
        : jsonResponse({}, generateStatus)
    }
    if (url === '/api/reading/next?wait=true') {
      return jsonResponse({ available: true, exercise })
    }
    if (url === '/api/reading/attempt')
      return jsonResponse(attempt, attemptStatus)
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

function attemptBody() {
  const call = mockApiFetch.mock.calls.find(
    ([url]) => url === '/api/reading/attempt'
  )
  return JSON.parse((call?.[1] as { body: string }).body) as {
    exercise_id: number
    answers: Record<string, string>
    replay: boolean
  }
}

function optionLabel(index: number, key: string) {
  const q = exercise.questions[index]
  if (!q) throw new Error(`Missing question at index ${index}`)
  const label = `${key}. ${q.options[key as 'a' | 'b']}`.replace(/\./g, '\\.')
  return new RegExp(label)
}

/** Answers every question, waits for the submit button and submits. */
async function answerExercise(picks: string[]) {
  exercise.questions.forEach((q, i) => {
    fireEvent.click(
      screen.getByRole('button', { name: optionLabel(i, picks[i] ?? '') })
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

describe('ReadingPage', () => {
  it('shows a loading state and then the available exercise', async () => {
    mockApi()
    render(<ReadingPage />)
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText(exercise.text)).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/reading/next')
    expect(screen.getByText('B1 · mcq · Stadt')).toBeInTheDocument()
  })

  it('reports a failed exercise request and offers generation', async () => {
    mockApi({ nextRejects: true })
    render(<ReadingPage />)
    expect(await screen.findByText('errorLoading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeInTheDocument()
  })

  it('treats a rejected next response as no available exercise', async () => {
    mockApi({ nextStatus: 500 })
    render(<ReadingPage />)
    expect(await screen.findByText('noExercises')).toBeInTheDocument()
    expect(screen.queryByText('errorLoading')).not.toBeInTheDocument()
  })

  it('generates a new exercise after the idle state', async () => {
    mockApi({ next: { available: false } })
    render(<ReadingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))
    expect(await screen.findByText(exercise.text)).toBeInTheDocument()
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/reading/next?wait=true',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('explains that generation needs an active study plan', async () => {
    mockApi({
      next: { available: false },
      generateStatus: 400,
      generateDetail: 'No active study plan found',
    })
    render(<ReadingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))
    expect(await screen.findByText('noActivePlan')).toBeInTheDocument()
  })

  it('keeps submit disabled until every question is answered', async () => {
    mockApi()
    render(<ReadingPage />)
    const submit = await screen.findByRole('button', { name: 'submit' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: optionLabel(0, 'a') }))
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: optionLabel(1, 'b') }))
    expect(submit).toBeEnabled()
  })

  it('marks correct and incorrect answers on the results screen', async () => {
    mockApi()
    render(<ReadingPage />)
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('resultsLabel')).toBeInTheDocument()
    expect(attemptBody()).toMatchObject({
      exercise_id: 7,
      answers: { '0': 'a', '1': 'b' },
      replay: false,
    })
    const review = document.querySelectorAll('.text-fl-success')
    expect(review.length).toBe(2)
    expect(document.querySelectorAll('.text-fl-error-fg').length).toBe(0)
  })

  it('strikes through the wrong answer and highlights the correct one', async () => {
    mockApi({
      attempt: {
        score: 0,
        xp_earned: 0,
        correct_answers: [
          { index: 0, correct: 'a' },
          { index: 1, correct: 'b' },
        ],
      },
    })
    render(<ReadingPage />)
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'a'])

    await screen.findByText('resultsLabel')
    expect(document.querySelectorAll('.line-through').length).toBe(1)
    expect(
      document.querySelectorAll('.text-fl-error-fg').length
    ).toBeGreaterThan(0)
    expect(document.querySelectorAll('.text-fl-success').length).toBe(2)
  })

  it('completes the flow by loading the next exercise from the results', async () => {
    let call = 0
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/reading/next') {
        call += 1
        return jsonResponse(
          call === 1
            ? { available: true, exercise }
            : {
                available: true,
                exercise: { ...exercise, id: 8, topic: 'Reise' },
              }
        )
      }
      if (url === '/api/reading/attempt') {
        return jsonResponse({
          score: 2,
          xp_earned: 15,
          correct_answers: [
            { index: 0, correct: 'a' },
            { index: 1, correct: 'b' },
          ],
        })
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ReadingPage />)
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'b'])
    await screen.findByText('resultsLabel')
    fireEvent.click(screen.getByRole('button', { name: 'nextExercise' }))
    expect(await screen.findByText('B1 · mcq · Reise')).toBeInTheDocument()
  })

  it('surfaces an already-attempted rejection and keeps the exercise', async () => {
    mockApi({ attempt: { detail: 'already_attempted' }, attemptStatus: 400 })
    render(<ReadingPage />)
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'b'])
    expect(await screen.findByText('alreadyAttempted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument()
    expect(mockReviewPrompt).not.toHaveBeenCalledWith(true)
  })

  it('replaces the submit error with a generic message on other failures', async () => {
    mockApi({ attempt: {}, attemptStatus: 500 })
    render(<ReadingPage />)
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'b'])
    expect(await screen.findByText('errorSubmit')).toBeInTheDocument()
  })

  it('opens the exercise history and returns to a new exercise', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/reading/next') {
        return jsonResponse({ available: false })
      }
      if (url.startsWith('/api/reading/history')) {
        return jsonResponse({
          total: 1,
          items: [
            {
              id: 3,
              score: 1,
              xp_earned: 5,
              completed_at: '2024-05-01T00:00:00Z',
              exercise,
              answers: { '0': 'a', '1': 'b' },
              correct_answers: [{ index: 0, correct: 'a' }],
            },
          ],
        })
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ReadingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'history' }))
    expect(await screen.findByText('historyTitle')).toBeInTheDocument()
    expect(await screen.findByText('1/2')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/reading/history?skip=0&limit=10'
    )
  })

  it('replays a history exercise without granting XP', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/reading/next') {
        return jsonResponse({ available: false })
      }
      if (url.startsWith('/api/reading/history')) {
        return jsonResponse({
          total: 1,
          items: [
            {
              id: 3,
              score: 2,
              xp_earned: 12,
              completed_at: '2024-05-01T00:00:00Z',
              exercise,
              answers: {},
              correct_answers: [],
            },
          ],
        })
      }
      if (url === '/api/reading/attempt') {
        return jsonResponse({
          score: 2,
          xp_earned: 12,
          correct_answers: [
            { index: 0, correct: 'a' },
            { index: 1, correct: 'b' },
          ],
        })
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ReadingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'history' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'practiceAgain' })
    )
    await answerExercise(['a', 'b'])
    expect(await screen.findByText('replayNoXp')).toBeInTheDocument()
    expect(attemptBody()).toMatchObject({ replay: true })
  })

  it('decrements the free reading quota after a first attempt', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    mockApi()
    render(<ReadingPage />)
    expect(mockFetchStatus).toHaveBeenCalled()
    await screen.findByText(exercise.text)
    await answerExercise(['a', 'b'])
    await waitFor(() =>
      expect(mockDecrement).toHaveBeenCalledWith('reading_remaining')
    )
  })

  it('blocks the exercise and shows the paywall when the reading quota is spent', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({ user: freeUser })
    useFreemiumStore.setState({
      status: { reading_remaining: 0, reading_limit: 3 } as never,
    })
    mockApi()
    render(<ReadingPage />)
    expect(await screen.findByTestId('paywall')).toHaveTextContent('reading')
    expect(screen.queryByText(exercise.text)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'submit' })
    ).not.toBeInTheDocument()
  })
})
