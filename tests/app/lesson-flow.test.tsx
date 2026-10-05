import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import spanishMessages from '../../messages/es.json'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  completeLesson: vi.fn(),
  fetchStatus: vi.fn(),
  dismissTooltip: vi.fn(),
  handleTextSelection: vi.fn(),
  translations: vi.fn((key: string) =>
    key === 'invalidExplanation'
      ? spanishMessages.lesson.invalidExplanation
      : key
  ),
}))

vi.mock('@/lib/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('use-intl', () => ({
  useTranslations: () => mocks.translations,
  useLocale: () => 'en',
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: object) => unknown) =>
    selector({ user: { username: 'learner', native_language: 'en' } }),
  isSubscribed: () => true,
  isFreemiumTrialActive: () => false,
}))
vi.mock('@/store/language', () => ({
  useLanguageStore: (selector: (state: object) => unknown) =>
    selector({ activeLanguage: { code: 'de-DE' } }),
}))
vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: object) => unknown) =>
    selector({ stripeEnabled: false }),
}))
vi.mock('@/store/freemium', () => ({
  useFreemiumStore: (selector: (state: object) => unknown) =>
    selector({ status: null, fetchStatus: mocks.fetchStatus }),
}))
vi.mock('@/store/progress', () => ({
  useProgressStore: (selector: (state: object) => unknown) =>
    selector({ completeLesson: mocks.completeLesson }),
}))
vi.mock('@/data/grammar', () => ({
  getGrammarTopics: () =>
    Promise.resolve([{ slug: 'present-tense', title: 'Present tense' }]),
}))
vi.mock('@/components/billing/PaywallBanner', () => ({
  PaywallBanner: () => null,
}))
vi.mock('@/components/billing/FreemiumQuotaBanner', () => ({
  FreemiumQuotaBanner: () => null,
}))
vi.mock('@/components/ui/AudioPlayer', () => ({ AudioPlayer: () => null }))
vi.mock('@/components/ui/VoiceRecorder', () => ({
  VoiceRecorder: ({
    studyPlanId,
    maxSeconds,
    disabled,
    onTranscription,
  }: {
    studyPlanId: number
    maxSeconds: number
    disabled: boolean
    onTranscription: (text: string) => void
  }) => (
    <div data-testid="voice-recorder" data-study-plan={studyPlanId}>
      <input aria-label="recording draft" />
      <button
        disabled={disabled}
        data-max-seconds={maxSeconds}
        onClick={() => onTranscription('Recorded answer')}
      >
        transcribe
      </button>
    </div>
  ),
}))
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }))
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
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">reviewPrompt</div> : null,
  getReviewPromptDismissal: () => ({ count: 0, lastDismissedAt: null }),
}))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({
    children,
    onPointerUp,
  }: {
    children: ReactNode
    onPointerUp?: () => void
  }) =>
    onPointerUp ? (
      <span onPointerUp={onPointerUp}>{children}</span>
    ) : (
      <>{children}</>
    ),
}))

import LessonPage from '@/app/(app)/lesson/[id]/page'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const lessonPayload = {
  lesson: {
    id: 1,
    study_plan_id: 1,
    title: 'Eine Lektion',
    lesson_type: 'writing',
    cefr_level: 'B1',
    content: { unit_id: 'unit-a' },
    is_completed: false,
  },
  exercises: [
    {
      id: 10,
      exercise_type: 'free_write',
      question: 'Beschreibe deinen Tag.',
      options: null,
      correct_answer: 'Ich lerne Deutsch.',
      explanation: null,
      native_explanation: null,
      user_answer: null,
      score: null,
      feedback: null,
      corrections: null,
      native_hint: null,
    },
  ],
}

function mockLessonLoad(response: Response) {
  mocks.apiFetch.mockImplementation((url: string) =>
    url === '/api/lessons/1'
      ? Promise.resolve(response)
      : Promise.resolve(jsonResponse({}))
  )
}

async function enterAnswer(answer: string) {
  fireEvent.change(await screen.findByPlaceholderText('yourAnswer'), {
    target: { value: answer },
  })
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'submitAnswer' })).toBeEnabled()
  })
}

describe('LessonPage lesson loading and answer flow', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    mocks.completeLesson.mockReset()
    mocks.fetchStatus.mockReset()
    mocks.dismissTooltip.mockReset()
    mocks.translations.mockClear()
  })

  it.each([
    { text: { secret: 'private-payload' } },
    { text: ['private-payload'] },
    { text: 42 },
    { text: false },
    ['private-payload'],
    42,
    false,
    'private-payload',
  ])(
    'shows safe errors for malformed explanation records: %#',
    async (value) => {
      mockLessonLoad(
        jsonResponse({
          ...lessonPayload,
          lesson: {
            ...lessonPayload.lesson,
            cefr_level: 'A1',
            content: { explanation: value, native_explanation: value },
          },
        })
      )
      const { container } = render(<LessonPage />)
      await screen.findByText('Eine Lektion')
      expect(screen.getAllByRole('alert')).toHaveLength(2)
      expect(
        screen.getAllByText(spanishMessages.lesson.invalidExplanation)
      ).toHaveLength(2)
      expect(container.textContent).not.toMatch(
        /private-payload|\[object Object\]/
      )
      expect(screen.getByRole('button', { name: 'retry' })).toBeEnabled()
    }
  )

  it.each([undefined, null, {}, { text: null }, { text: '' }])(
    'preserves absent and empty explanation contracts: %#',
    async (value) => {
      mockLessonLoad(
        jsonResponse({
          ...lessonPayload,
          lesson: {
            ...lessonPayload.lesson,
            cefr_level: 'A1',
            content: { explanation: value, native_explanation: value },
          },
        })
      )
      render(<LessonPage />)
      await screen.findByText('Eine Lektion')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'retry' })
      ).not.toBeInTheDocument()
      expect(
        !!screen.queryByRole('button', { name: /showNativeExplanation/ })
      ).toBe(value == null)
    }
  )

  it('uses the displayed validated target text for selection and recovers invalid native content', async () => {
    const payload = {
      ...lessonPayload,
      lesson: {
        ...lessonPayload.lesson,
        cefr_level: 'A1',
        content: {
          explanation: { text: 'Validated target rule' },
          native_explanation: { text: { secret: 'private-payload' } },
        },
      },
    }
    mocks.apiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url === '/api/lessons/1'
            ? payload
            : url === '/api/lessons/1/native-explanation'
              ? { native_explanation: { text: 'Recovered native rule' } }
              : {}
        )
      )
    )
    render(<LessonPage />)
    fireEvent.pointerUp(await screen.findByText('Validated target rule'))
    expect(mocks.handleTextSelection).toHaveBeenCalledWith(
      'Validated target rule',
      'A1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByText('Recovered native rule')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/lessons/1/native-explanation',
      { method: 'POST' }
    )
  })

  it('keeps malformed generated native content recoverable after a failed retry', async () => {
    let attempts = 0
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(
          jsonResponse({
            ...lessonPayload,
            lesson: { ...lessonPayload.lesson, content: {} },
          })
        )
      if (url === '/api/lessons/1/native-explanation') {
        attempts += 1
        return Promise.resolve(
          attempts === 1
            ? jsonResponse({
                native_explanation: { text: ['private-payload'] },
              })
            : attempts === 2
              ? jsonResponse({}, 503)
              : jsonResponse({
                  native_explanation: { text: 'Recovered generated rule' },
                })
        )
      }
      return Promise.resolve(jsonResponse({}))
    })
    const { container } = render(<LessonPage />)
    await screen.findByText('Eine Lektion')
    fireEvent.click(screen.getByRole('button', { name: /^en/ }))
    fireEvent.click(
      screen.getByRole('button', { name: /showNativeExplanation/ })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      spanishMessages.lesson.invalidExplanation
    )
    expect(container.textContent).not.toContain('private-payload')
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'retry' })).toBeEnabled()
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(
      await screen.findByText('Recovered generated rule')
    ).toBeInTheDocument()
  })

  it('shows a load error and retries the lesson request', async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation((url: string) =>
        url === '/api/lessons/1'
          ? Promise.resolve(jsonResponse(lessonPayload))
          : Promise.resolve(jsonResponse({}))
      )

    render(<LessonPage />)

    expect(await screen.findByText('body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(await screen.findByText('Eine Lektion')).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1')
    expect(
      mocks.apiFetch.mock.calls.filter(([url]) => url === '/api/lessons/1')
    ).toHaveLength(2)
  })

  it('recovers from a malformed payload when the learner retries', async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(jsonResponse({ lesson: lessonPayload.lesson }))
      .mockImplementation((url: string) =>
        url === '/api/lessons/1'
          ? Promise.resolve(jsonResponse(lessonPayload))
          : Promise.resolve(jsonResponse({}))
      )

    render(<LessonPage />)

    expect(await screen.findByText('body')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'backToPlan' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(await screen.findByText('Eine Lektion')).toBeInTheDocument()
    expect(screen.getByText('Beschreibe deinen Tag.')).toBeInTheDocument()
    expect(
      mocks.apiFetch.mock.calls.filter(([url]) => url === '/api/lessons/1')
    ).toHaveLength(2)
  })

  it('shows submit failure and allows the learner to retry the answer', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer') {
        if (
          mocks.apiFetch.mock.calls.filter(([calledUrl]) => calledUrl === url)
            .length === 1
        ) {
          return Promise.reject(new Error('network unavailable'))
        }
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))

    expect(await screen.findByText('title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('yourAnswer')).toHaveValue(
      'Ich lerne Deutsch.'
    )
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))

    expect(await screen.findByText('Well done')).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/lessons/exercises/10/answer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ answer: 'Ich lerne Deutsch.' }),
      })
    )
    expect(screen.queryByText('title')).not.toBeInTheDocument()
  })

  it('does not submit an empty answer', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')

    expect(screen.getByRole('button', { name: 'submitAnswer' })).toBeDisabled()
    expect(
      mocks.apiFetch.mock.calls.some(
        ([url]) => url === '/api/lessons/exercises/10/answer'
      )
    ).toBe(false)
  })

  it('treats a non-OK answer response with JSON as an evaluated answer', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer') {
        return Promise.resolve(
          jsonResponse({ score: 0, feedback: 'Rejected by server' }, 500)
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await enterAnswer('Antwort')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))

    expect(await screen.findByText('Rejected by server')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'submitAnswer' })).toBeNull()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows regeneration errors and replaces the exercise after a retry succeeds', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/regenerate') {
        const attempts = mocks.apiFetch.mock.calls.filter(
          ([calledUrl]) => calledUrl === url
        ).length
        return Promise.resolve(
          attempts === 1
            ? jsonResponse({}, 503)
            : jsonResponse({
                ...lessonPayload.exercises[0],
                question: 'Erzähle von gestern.',
              })
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')
    await enterAnswer('Meine Antwort')
    fireEvent.click(screen.getByRole('button', { name: 'regenerateExercise' }))

    expect(await screen.findByText('regenerateError')).toBeInTheDocument()
    expect(screen.getByText('Beschreibe deinen Tag.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('yourAnswer')).toHaveValue(
      'Meine Antwort'
    )

    fireEvent.click(screen.getByRole('button', { name: 'regenerateExercise' }))

    expect(await screen.findByText('Erzähle von gestern.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('yourAnswer')).toHaveValue('')
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([url]) => url === '/api/lessons/exercises/10/regenerate'
      )
    ).toHaveLength(2)
  })

  it('distinguishes a regeneration request rejected because it is not needed', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/lessons/1'
        ? Promise.resolve(jsonResponse(lessonPayload))
        : url === '/api/lessons/exercises/10/regenerate'
          ? Promise.resolve(jsonResponse({}, 400))
          : Promise.resolve(jsonResponse({}))
    )

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')
    fireEvent.click(screen.getByRole('button', { name: 'regenerateExercise' }))

    expect(await screen.findByText('regenerateNotNeeded')).toBeInTheDocument()
  })

  it('marks a wrong multiple-choice selection and restores a saved next answer', async () => {
    const lessonWithChoices = {
      ...lessonPayload,
      exercises: [
        {
          ...lessonPayload.exercises[0]!,
          exercise_type: 'multiple_choice',
          question: 'Choose the correct phrase.',
          options: ['Wrong phrase', 'Correct phrase'],
          correct_answer: 'Correct phrase',
        },
        {
          ...lessonPayload.exercises[0]!,
          id: 11,
          question: 'Write another phrase.',
          user_answer: 'Saved response',
          score: 0.5,
        },
      ],
    }
    mockLessonLoad(jsonResponse(lessonWithChoices))
    mocks.apiFetch.mockImplementation((url: string) =>
      url === '/api/lessons/1'
        ? Promise.resolve(jsonResponse(lessonWithChoices))
        : url === '/api/lessons/exercises/10/answer'
          ? Promise.resolve(jsonResponse({ score: 0, feedback: 'Try again' }))
          : Promise.resolve(jsonResponse({}))
    )

    render(<LessonPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Wrong phrase' }))
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))

    expect(
      await screen.findByRole('img', { name: 'incorrect' })
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'correct' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next/ }))

    expect(await screen.findByPlaceholderText('yourAnswer')).toHaveValue(
      'Saved response'
    )
  })

  it('completes the lesson and reports that the study day advanced', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    let todayRequests = 0
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/study-plan/today') {
        todayRequests += 1
        return Promise.resolve(
          jsonResponse({ progress_day: todayRequests === 1 ? 3 : 4 })
        )
      }
      if (url === '/api/lessons/exercises/10/answer') {
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      }
      if (url === '/api/lessons/1/complete')
        return Promise.resolve(jsonResponse({}))
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    await screen.findByText('Well done')
    fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

    expect(await screen.findByText('lessonDone')).toBeInTheDocument()
    expect(screen.getByText('dayComplete')).toBeInTheDocument()
    expect(screen.getByText('exerciseSummary')).toBeInTheDocument()
    expect(mocks.completeLesson).toHaveBeenCalledWith(1)
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1/complete', {
      method: 'POST',
    })
    expect(todayRequests).toBe(2)
  })

  it('keeps the lesson open when lesson completion is rejected', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer') {
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      }
      if (url === '/api/lessons/1/complete') {
        return Promise.resolve(jsonResponse({}, 503))
      }
      return Promise.resolve(jsonResponse({ progress_day: 3 }))
    })

    render(<LessonPage />)
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    await screen.findByText('Well done')
    fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'completeLesson' })
      ).toBeEnabled()
    })
    expect(screen.queryByText('lessonDone')).not.toBeInTheDocument()
    expect(mocks.completeLesson).not.toHaveBeenCalled()
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1/complete', {
      method: 'POST',
    })
  })

  it('opens the review prompt when the next study-plan lesson is in another unit', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    let todayRequests = 0
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer')
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      if (url === '/api/lessons/1/complete')
        return Promise.resolve(jsonResponse({}))
      if (url === '/api/study-plan/today') {
        todayRequests += 1
        return Promise.resolve(
          jsonResponse({
            progress_day: 3,
            lessons: todayRequests === 1 ? [] : [{ unit_id: 'unit-b' }],
          })
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    await screen.findByText('Well done')
    fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

    expect(await screen.findByText('lessonDone')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('reviewPrompt')
    expect(screen.getByRole('link', { name: 'backToPlan' })).toHaveAttribute(
      'href',
      '/plan'
    )
    expect(mocks.completeLesson).toHaveBeenCalledWith(1)
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1/complete', {
      method: 'POST',
    })
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([url]) => url === '/api/study-plan/today'
      )
    ).toHaveLength(2)
    expect(todayRequests).toBe(2)
  })

  it('opens the review prompt when the study plan reaches its terminal position', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    let todayRequests = 0
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer')
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      if (url === '/api/lessons/1/complete')
        return Promise.resolve(jsonResponse({}))
      if (url === '/api/study-plan/today') {
        todayRequests += 1
        return Promise.resolve(
          jsonResponse(
            todayRequests === 1
              ? { progress_day: 3 }
              : { progress_day: 3, completion: { state: 'ready' } }
          )
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    await screen.findByText('Well done')
    fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

    expect(await screen.findByText('lessonDone')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('reviewPrompt')
    expect(mocks.completeLesson).toHaveBeenCalledWith(1)
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1/complete', {
      method: 'POST',
    })
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([url]) => url === '/api/study-plan/today'
      )
    ).toHaveLength(2)
    expect(todayRequests).toBe(2)
  })

  it.each([
    ['non-OK', () => Promise.resolve(jsonResponse({}, 503))],
    ['thrown', () => Promise.reject(new Error('study plan unavailable'))],
  ])(
    'preserves lesson completion when the follow-up study-plan read is %s',
    async (_failure, readToday) => {
      mockLessonLoad(jsonResponse(lessonPayload))
      let todayRequests = 0
      mocks.apiFetch.mockImplementation((url: string) => {
        if (url === '/api/lessons/1')
          return Promise.resolve(jsonResponse(lessonPayload))
        if (url === '/api/lessons/exercises/10/answer')
          return Promise.resolve(
            jsonResponse({ score: 1, feedback: 'Well done' })
          )
        if (url === '/api/lessons/1/complete')
          return Promise.resolve(jsonResponse({}))
        if (url === '/api/study-plan/today') {
          todayRequests += 1
          return todayRequests === 1
            ? Promise.resolve(jsonResponse({ progress_day: 3 }))
            : readToday()
        }
        return Promise.resolve(jsonResponse({}))
      })

      render(<LessonPage />)
      await screen.findByText('Beschreibe deinen Tag.')
      await enterAnswer('Ich lerne Deutsch.')
      fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
      await screen.findByText('Well done')
      fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

      expect(await screen.findByText('lessonDone')).toBeInTheDocument()
      expect(screen.queryByText('dayComplete')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'backToPlan' })).toHaveAttribute(
        'href',
        '/plan'
      )
      expect(mocks.completeLesson).toHaveBeenCalledWith(1)
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/lessons/1/complete', {
        method: 'POST',
      })
      expect(
        mocks.apiFetch.mock.calls.filter(
          ([url]) => url === '/api/study-plan/today'
        )
      ).toHaveLength(2)
      expect(todayRequests).toBe(2)
    }
  )

  it('completes the lesson without a day banner when the plan day is unchanged', async () => {
    mockLessonLoad(jsonResponse(lessonPayload))
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/exercises/10/answer') {
        return Promise.resolve(
          jsonResponse({ score: 1, feedback: 'Well done' })
        )
      }
      if (url === '/api/lessons/1/complete')
        return Promise.resolve(jsonResponse({}))
      return Promise.resolve(jsonResponse({ progress_day: 3 }))
    })

    render(<LessonPage />)
    await screen.findByText('Beschreibe deinen Tag.')
    await enterAnswer('Ich lerne Deutsch.')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    await screen.findByText('Well done')
    fireEvent.click(screen.getByRole('button', { name: 'completeLesson' }))

    expect(await screen.findByText('lessonDone')).toBeInTheDocument()
    expect(screen.queryByText('dayComplete')).not.toBeInTheDocument()
    expect(mocks.completeLesson).toHaveBeenCalledWith(1)
  })

  it('generates lesson and exercise hints and native explanations with retries', async () => {
    const payload = {
      ...lessonPayload,
      lesson: {
        ...lessonPayload.lesson,
        content: {
          ...lessonPayload.lesson.content,
          explanation: {
            text: 'Target language rule',
            key_points: ['First point'],
            examples: [{ sentence: 'Example sentence', note: 'Example note' }],
          },
        },
      },
      exercises: [
        {
          ...lessonPayload.exercises[0],
          explanation: 'Exercise explanation',
        },
      ],
    }
    let lessonExplanationAttempts = 0
    let hintAttempts = 0
    let exerciseExplanationAttempts = 0
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(payload))
      if (url === '/api/lessons/1/native-explanation') {
        lessonExplanationAttempts += 1
        return Promise.resolve(
          lessonExplanationAttempts === 1
            ? jsonResponse({}, 503)
            : jsonResponse({
                native_explanation: { text: 'Native lesson rule' },
              })
        )
      }
      if (url === '/api/lessons/exercises/10/native-hint') {
        hintAttempts += 1
        return Promise.resolve(
          hintAttempts === 1
            ? jsonResponse({}, 503)
            : jsonResponse({ native_hint: 'Useful native hint' })
        )
      }
      if (url === '/api/lessons/exercises/10/answer')
        return Promise.resolve(
          jsonResponse({ score: 0, feedback: 'Try again' })
        )
      if (url === '/api/lessons/exercises/10/native-explanation') {
        exerciseExplanationAttempts += 1
        return Promise.resolve(
          exerciseExplanationAttempts === 1
            ? jsonResponse({}, 503)
            : jsonResponse({
                native_explanation: 'Native exercise explanation',
              })
        )
      }
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    expect(await screen.findByText('Target language rule')).toBeInTheDocument()
    expect(screen.getByText('First point')).toBeInTheDocument()
    expect(screen.getByText('Example sentence')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^en/ }))
    fireEvent.click(
      screen.getByRole('button', { name: /showNativeExplanation en/ })
    )
    expect(await screen.findByRole('button', { name: 'retry' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByRole('button', { name: /^en/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(await screen.findByText('Native lesson rule')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /showNativeHint en/ }))
    expect(await screen.findByRole('button', { name: 'retry' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByText('Useful native hint')).toBeInTheDocument()

    await enterAnswer('Meine Antwort')
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))
    expect(await screen.findByText('Try again')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /showNativeExplanation en/ })
    )
    expect(await screen.findByRole('button', { name: 'retry' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(
      await screen.findByText('Native exercise explanation')
    ).toBeInTheDocument()

    expect(lessonExplanationAttempts).toBe(2)
    expect(hintAttempts).toBe(2)
    expect(exerciseExplanationAttempts).toBe(2)
  })

  it('submits a selected multiple-choice option and advances to the next exercise', async () => {
    const payload = {
      ...lessonPayload,
      exercises: [
        {
          ...lessonPayload.exercises[0],
          exercise_type: 'multiple_choice',
          question: 'Choose the correct sentence.',
          options: ['Ich lerne Deutsch.', 'Ich lernst Deutsch.'],
          correct_answer: 'Ich lerne Deutsch.',
        },
        {
          ...lessonPayload.exercises[0],
          id: 11,
          question: 'Write one more sentence.',
        },
      ],
    }
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(payload))
      if (url === '/api/lessons/exercises/10/answer')
        return Promise.resolve(
          jsonResponse({ score: 0, feedback: 'Incorrect' })
        )
      return Promise.resolve(jsonResponse({}))
    })

    render(<LessonPage />)
    expect(
      await screen.findByText('Choose the correct sentence.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ich lernst Deutsch.' }))
    expect(screen.getByRole('button', { name: 'submitAnswer' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'submitAnswer' }))

    expect(await screen.findByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'incorrect' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'correct' })).toBeInTheDocument()
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/lessons/exercises/10/answer',
      expect.objectContaining({
        body: JSON.stringify({ answer: 'Ich lernst Deutsch.' }),
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    expect(
      await screen.findByText('Write one more sentence.')
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('yourAnswer')).toHaveValue('')
  })

  it('keeps the pronunciation recorder mounted across parent updates and submits its transcription', async () => {
    const payload = {
      ...lessonPayload,
      lesson: { ...lessonPayload.lesson, study_plan_id: 42 },
      exercises: [
        {
          ...lessonPayload.exercises[0]!,
          exercise_type: 'pronunciation',
          question: 'Say the target phrase.',
          options: ['Pronunciation guidance'],
        },
      ],
    }
    let resolveAnswer!: (response: Response) => void
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(payload))
      if (url === '/api/lessons/exercises/10/answer') {
        return new Promise<Response>((resolve) => {
          resolveAnswer = resolve
        })
      }
      return Promise.resolve(jsonResponse({}))
    })
    render(<LessonPage />)
    const recorder = await screen.findByTestId('voice-recorder')
    const draft = screen.getByRole('textbox', { name: 'recording draft' })
    fireEvent.change(draft, { target: { value: 'In-progress recording' } })
    expect(recorder).toHaveAttribute('data-study-plan', '42')
    expect(screen.getByRole('button', { name: 'transcribe' })).toHaveAttribute(
      'data-max-seconds',
      '8'
    )
    expect(screen.getByText('Pronunciation guidance')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'submitAnswer' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^en/ }))
    expect(screen.getByTestId('voice-recorder')).toBe(recorder)
    expect(screen.getByRole('textbox', { name: 'recording draft' })).toBe(draft)
    expect(draft).toHaveValue('In-progress recording')

    fireEvent.click(screen.getByRole('button', { name: 'transcribe' }))
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/lessons/exercises/10/answer',
      expect.objectContaining({
        body: JSON.stringify({ answer: 'Recorded answer' }),
      })
    )
    expect(screen.getByTestId('voice-recorder')).toBe(recorder)
    expect(screen.getByRole('button', { name: 'transcribe' })).toBeDisabled()
    expect(screen.getByText('checking')).toBeInTheDocument()
    await act(async () => {
      resolveAnswer(
        jsonResponse({ score: 1, feedback: 'Pronunciation accepted' })
      )
    })
    expect(
      await screen.findByText('Pronunciation accepted')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('voice-recorder')).toBeNull()
  })

  it('preserves native subsection order and duplicate occurrence nodes across answer updates', async () => {
    const payload = {
      ...lessonPayload,
      lesson: {
        ...lessonPayload.lesson,
        cefr_level: 'A2',
        content: {
          explanation: { text: 'Target rule' },
          native_explanation: {
            text: 'Native rule',
            key_points: ['Native point', 'Native point'],
            examples: [{ sentence: 'Native example', note: 'Example note' }],
            common_traps: [
              { mistake: 'Common mistake', fix: 'Recommended fix' },
            ],
            mini_glossary: [
              {
                term: 'Glossary term',
                meaning: 'Native meaning',
                note: 'Glossary note',
              },
            ],
          },
        },
      },
    }
    mockLessonLoad(jsonResponse(payload))
    render(<LessonPage />)
    const nativeRule = await screen.findByText('Native rule')
    const points = screen.getAllByText('Native point')
    const nativeSection = nativeRule.parentElement!
    expect(nativeSection.children).toHaveLength(5)
    expect(
      Array.from(nativeSection.children).map((node) => node.textContent)
    ).toEqual([
      'Native rule',
      '·Native point·Native point',
      'examples·Native exampleExample note',
      'commonTrapsCommon mistakeRecommended fix',
      'miniGlossaryGlossary termNative meaningGlossary note',
    ])
    await enterAnswer('Unsubmitted answer')
    expect(screen.getByText('Native rule')).toBe(nativeRule)
    expect(screen.getAllByText('Native point')).toEqual(points)
    expect(points[0]).not.toBe(points[1])
    fireEvent.click(screen.getByRole('button', { name: /^en/ }))
    expect(screen.queryByText('Native rule')).toBeNull()
    expect(screen.getByPlaceholderText('yourAnswer')).toHaveValue(
      'Unsubmitted answer'
    )
  })

  it('translates only the selected native-request label while pending and after failure', async () => {
    let rejectRequest!: (reason: Error) => void
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/lessons/1')
        return Promise.resolve(jsonResponse(lessonPayload))
      if (url === '/api/lessons/1/native-explanation') {
        return new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject
        })
      }
      return Promise.resolve(jsonResponse({}))
    })
    render(<LessonPage />)
    await screen.findByText('Eine Lektion')
    expect(mocks.translations).not.toHaveBeenCalledWith('showNativeExplanation')
    expect(mocks.translations).not.toHaveBeenCalledWith('retry')
    fireEvent.click(screen.getByRole('button', { name: /^en/ }))
    const request = screen.getByRole('button', {
      name: /showNativeExplanation/,
    })
    mocks.translations.mockClear()
    fireEvent.click(request)
    expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
    expect(mocks.translations).not.toHaveBeenCalledWith('showNativeExplanation')
    expect(mocks.translations).not.toHaveBeenCalledWith('retry')
    mocks.translations.mockClear()
    await act(async () => {
      rejectRequest(new Error('native explanation unavailable'))
    })
    expect(await screen.findByRole('button', { name: 'retry' })).toBeEnabled()
    expect(mocks.translations).toHaveBeenCalledWith('retry')
    expect(mocks.translations).not.toHaveBeenCalledWith('showNativeExplanation')
  })

  it('renders available vocabulary details and only links known grammar topics', async () => {
    const payload = {
      ...lessonPayload,
      lesson: {
        ...lessonPayload.lesson,
        content: {
          ...lessonPayload.lesson.content,
          vocabulary: [
            {
              word: 'Haus',
              reading: 'haus',
              translation: 'house',
              definition: 'A place to live.',
              example: 'Das Haus ist groß.',
              example_translation: 'The house is large.',
              note: 'A noun.',
            },
            { word: 'klein' },
            { translation: 'unused without a word' },
          ],
          grammar_refs: ['present-tense', 'not-found'],
        },
      },
    }
    mockLessonLoad(jsonResponse(payload))

    render(<LessonPage />)

    expect(await screen.findByText('Haus')).toBeInTheDocument()
    expect(screen.getByText('house')).toBeInTheDocument()
    expect(screen.getByText('A place to live.')).toBeInTheDocument()
    expect(screen.getByText('Das Haus ist groß.')).toBeInTheDocument()
    expect(screen.getByText('The house is large.')).toBeInTheDocument()
    expect(screen.getByText('A noun.')).toBeInTheDocument()
    expect(screen.getByText('klein')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Present tense/ })).toHaveAttribute(
      'href',
      '/grammar/present-tense'
    )
    expect(screen.queryByRole('link', { name: /not-found/ })).toBeNull()
  })
})
