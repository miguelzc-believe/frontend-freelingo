import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ListeningExercise } from '@/types/api'

const {
  mockApiFetch,
  mockFetchStatus,
  mockDecrement,
  mockTranslate,
  mockDismissTooltip,
  mockHandleTextSelection,
  mockTranslationNamespace,
  wordSelection,
} = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockFetchStatus: vi.fn().mockResolvedValue(undefined),
  mockDecrement: vi.fn(),
  mockTranslate: (key: string) => key,
  mockDismissTooltip: vi.fn(),
  mockHandleTextSelection: vi.fn(),
  mockTranslationNamespace: vi.fn(),
  wordSelection: { word: null as string | null },
}))

// Stable reference: the page's load effect depends on `t`.
vi.mock('use-intl', () => ({
  useTranslations: (namespace: string) => {
    mockTranslationNamespace(namespace)
    return mockTranslate
  },
}))
vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label, subtext }: { label?: string; subtext?: string }) => (
    <div>
      {label ?? 'loading'}
      {subtext && <span>{subtext}</span>}
    </div>
  ),
}))
vi.mock('@/components/ui/WordTooltip', () => ({
  WordTooltip: ({ word }: { word: string }) => (
    <div data-testid="word-tooltip">{word}</div>
  ),
  useWordSave: () => ({
    selectedWord: wordSelection.word,
    tooltipPos: null,
    saveState: 'idle',
    handleTextSelection: mockHandleTextSelection,
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
  wordSelection.word = null
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

  it('preserves exercise-language choices, listening-specific classes and word selection', async () => {
    mockApi({
      next: {
        available: true,
        exercise: { ...exercise, target_language: 'ja-JP' },
      },
    })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    const question = screen.getByText('1. Wohin fährt der Zug?')
    const option = screen.getByRole('button', { name: optionLabel(0, 'a') })
    expect(question).toHaveAttribute('lang', 'ja-JP')
    expect(screen.getByText('Nach Berlin')).toHaveAttribute('lang', 'ja-JP')
    expect(option).toHaveAttribute(
      'class',
      'w-full border px-3 py-2 text-left transition-colors border-fl-border text-fl-muted-1 hover:border-fl-border-2 hover:text-fl-fg hover:bg-fl-surface-2'
    )
    fireEvent.pointerUp(question)
    expect(mockHandleTextSelection).toHaveBeenCalledExactlyOnceWith(
      'Wohin fährt der Zug?',
      'B1'
    )
    fireEvent.click(option)
    expect(option).toHaveAttribute(
      'class',
      'w-full border px-3 py-2 text-left transition-colors border-fl-accent bg-fl-surface-2 text-fl-fg'
    )
    expect(mockTranslationNamespace).toHaveBeenCalledWith('listening')
    expect(mockTranslationNamespace).not.toHaveBeenCalledWith('reading')
  })

  it('keeps transcript language and selection separate from the active-language result review', async () => {
    mockApi({
      next: {
        available: true,
        exercise: { ...exercise, target_language: 'ja-JP' },
      },
    })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])
    await screen.findByText('resultsLabel')
    const transcript = screen.getByText('Der Zug fährt um zehn Uhr ab.')
    expect(transcript).toHaveAttribute('lang', 'ja-JP')
    expect(transcript).toHaveClass(
      'word-selectable',
      'cursor-text',
      'select-text'
    )
    expect(screen.getByText('1. Wohin fährt der Zug?')).toHaveAttribute(
      'lang',
      'de'
    )
    expect(screen.getByText('Nach Berlin')).toHaveAttribute('lang', 'de')
    fireEvent.pointerUp(transcript)
    expect(mockHandleTextSelection).toHaveBeenCalledExactlyOnceWith(
      'Der Zug fährt um zehn Uhr ab.',
      'B1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'viewHistory' }))
    expect(await screen.findByText('historyEmpty')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/listening/history?skip=0&limit=10'
    )
  })

  it('uses B1 when selecting a transcript from an exercise without a level', async () => {
    mockApi({
      next: { available: true, exercise: { ...exercise, level: null } },
    })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])
    const transcript = await screen.findByText('Der Zug fährt um zehn Uhr ab.')
    fireEvent.pointerUp(transcript)
    expect(mockHandleTextSelection).toHaveBeenCalledWith(
      'Der Zug fährt um zehn Uhr ab.',
      'B1'
    )
  })

  it('reports a generation failure when the long poll responds with an HTTP error', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/api/listening/next')
        return Promise.resolve(jsonResponse({ available: false }))
      if (url === '/api/listening/generate')
        return Promise.resolve(jsonResponse({}, 202))
      if (url === '/api/listening/next?wait=true')
        return Promise.resolve(jsonResponse({}, 503))
      return Promise.resolve(jsonResponse({}))
    })
    render(<ListeningPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))
    expect(await screen.findByText('generationFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
  })

  it('keeps the selected-word tooltip in listening exercises, results and history', async () => {
    wordSelection.word = 'Zug'
    mockApi()
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    expect(screen.getByTestId('word-tooltip')).toHaveTextContent('Zug')
    mockDismissTooltip.mockClear()
    await answerExercise(['a', 'b'])
    await screen.findByText('resultsLabel')
    expect(mockDismissTooltip).not.toHaveBeenCalled()
    expect(screen.getByTestId('word-tooltip')).toHaveTextContent('Zug')
    fireEvent.click(screen.getByRole('button', { name: 'viewHistory' }))
    await screen.findByText('historyEmpty')
    expect(screen.getByTestId('word-tooltip')).toHaveTextContent('Zug')
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
    const historyText = screen.getByText('Der Zug fährt um zehn Uhr ab.')
    expect(historyText).toHaveAttribute('lang', 'de')
    expect(historyText).toHaveClass(
      'word-selectable',
      'cursor-text',
      'border-t',
      'pt-3',
      'select-text'
    )
    expect(historyText).not.toHaveClass('line-clamp-3')
    fireEvent.pointerUp(historyText)
    expect(mockHandleTextSelection).toHaveBeenCalledExactlyOnceWith(
      'Der Zug fährt um zehn Uhr ab.',
      'B1'
    )
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

  it('shows an empty history when the history endpoint returns an HTTP error', async () => {
    mockApi()
    const original = mockApiFetch.getMockImplementation()!
    mockApiFetch.mockImplementation((url: string, options?: RequestInit) =>
      url.startsWith('/api/listening/history?')
        ? Promise.resolve(new Response(null, { status: 503 }))
        : original(url, options)
    )
    render(<ListeningPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'history' }))
    expect(await screen.findByText('historyEmpty')).toBeInTheDocument()
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

  it('generates an exercise and waits for the long-poll result', async () => {
    mockApiFetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (url === '/api/listening/next')
          return jsonResponse({ available: false })
        if (url === '/api/listening/generate') return jsonResponse({}, 202)
        if (url === '/api/listening/next?wait=true')
          return jsonResponse({ available: true, exercise })
        throw new Error(`Unexpected apiFetch: ${url} ${options?.method ?? ''}`)
      }
    )
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('Am Bahnhof')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/listening/generate', {
      method: 'POST',
    })
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/listening/next?wait=true',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('explains when exercise generation has no active study plan', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next')
        return jsonResponse({ available: false })
      if (url === '/api/listening/generate')
        return jsonResponse({ detail: 'No active study plan found' }, 400)
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('noActivePlan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
  })

  it('returns to the empty state when generation polling has no result', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next')
        return jsonResponse({ available: false })
      if (url === '/api/listening/generate') return jsonResponse({})
      if (url === '/api/listening/next?wait=true')
        return jsonResponse({ available: false })
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('generationFailed')).toBeInTheDocument()
    expect(screen.getByText('noExercises')).toBeInTheDocument()
  })

  it('shows the generic generation error for other rejected generation responses', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next')
        return jsonResponse({ available: false })
      if (url === '/api/listening/generate') return jsonResponse({}, 503)
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('errorLoading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
  })

  it('shows a slow-generation warning and aborts the pending request on unmount', async () => {
    let signal: AbortSignal | undefined
    mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/listening/next')
        return Promise.resolve(jsonResponse({ available: false }))
      if (url === '/api/listening/generate')
        return Promise.resolve(jsonResponse({}, 202))
      if (url === '/api/listening/next?wait=true') {
        signal = options?.signal as AbortSignal
        return new Promise(() => {})
      }
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    const view = render(<ListeningPage />)
    const generate = await screen.findByRole('button', { name: 'generate' })
    vi.useFakeTimers()
    try {
      await act(async () => {
        fireEvent.click(generate)
        await Promise.resolve()
      })
      expect(screen.getByText('generatingDesc')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(
        screen.getByText('generatingDesc generatingLong')
      ).toBeInTheDocument()
      view.unmount()
      expect(signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('includes the selected voice during generation and handles invalid error JSON', async () => {
    localStorage.setItem('tts_voice', 'voice one')
    try {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === '/api/listening/next')
          return Promise.resolve(jsonResponse({ available: false }))
        if (url === '/api/listening/generate?voice=voice%20one')
          return Promise.resolve(new Response('invalid', { status: 500 }))
        throw new Error(`Unexpected apiFetch: ${url}`)
      })
      render(<ListeningPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'generate' }))
      expect(await screen.findByText('errorLoading')).toBeInTheDocument()
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/listening/generate?voice=voice%20one',
        { method: 'POST' }
      )
    } finally {
      localStorage.removeItem('tts_voice')
    }
  })

  it('recovers from invalid attempt error JSON without losing the answers', async () => {
    mockApi()
    const original = mockApiFetch.getMockImplementation()!
    mockApiFetch.mockImplementation((url: string) =>
      url === '/api/listening/attempt'
        ? Promise.resolve(new Response('invalid', { status: 500 }))
        : original(url)
    )
    render(<ListeningPage />)
    await screen.findByTestId('audio-player')
    fireEvent.click(screen.getByRole('button', { name: optionLabel(0, 'a') }))
    fireEvent.click(screen.getByRole('button', { name: optionLabel(1, 'b') }))
    fireEvent.click(screen.getByRole('button', { name: 'submit' }))
    expect(await screen.findByText('errorSubmit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled()
  })

  it('reports a polling network error after generation starts', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next')
        return jsonResponse({ available: false })
      if (url === '/api/listening/generate') return jsonResponse({})
      if (url === '/api/listening/next?wait=true')
        throw new Error('poll failed')
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('generationFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
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

  it('shows a generic submit error when the attempt request fails', async () => {
    mockApi({ attempt: { detail: 'service unavailable' }, attemptStatus: 503 })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('errorSubmit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument()
  })

  it('shows a submit error when the attempt request rejects', async () => {
    mockApi()
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/listening/next')
        return jsonResponse({ available: true, exercise })
      if (url === '/api/listening/attempt') throw new Error('request failed')
      if (url.startsWith('/api/listening/history?'))
        return jsonResponse({ items: [], total: 0 })
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<ListeningPage />)
    await screen.findByText('Am Bahnhof')
    await answerExercise(['a', 'b'])

    expect(await screen.findByText('errorSubmit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument()
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

  it.each([
    { status: 'none', trial: false, remaining: 1 },
    { status: 'none', trial: true, remaining: 0 },
    { status: 'active', trial: false, remaining: 0 },
  ] as const)(
    'allows listening for eligible quota or subscription case %#',
    async ({ status, trial, remaining }) => {
      useConfigStore.setState({ stripeEnabled: true })
      useAuthStore.setState({
        user: {
          ...freeUser,
          subscription_status: status,
          ...(trial
            ? {
                freemium_trial_ends_at: new Date(
                  Date.now() + 86400000
                ).toISOString(),
              }
            : {}),
        },
      })
      useFreemiumStore.setState({
        status: { listening_remaining: remaining, listening_limit: 3 } as never,
      })
      mockApi()
      render(<ListeningPage />)
      expect(await screen.findByTestId('audio-player')).toBeInTheDocument()
      expect(screen.queryByTestId('paywall')).not.toBeInTheDocument()
      await answerExercise(['a', 'b'])
      await screen.findByText('resultsLabel')
      if (status === 'none' && !trial)
        expect(mockDecrement).toHaveBeenCalledWith('listening_remaining')
      else expect(mockDecrement).not.toHaveBeenCalled()
    }
  )
})
