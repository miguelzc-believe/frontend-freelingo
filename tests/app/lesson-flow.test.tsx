import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  completeLesson: vi.fn(),
  fetchStatus: vi.fn(),
  dismissTooltip: vi.fn(),
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
  useTranslations: () => (key: string) => key,
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
  getGrammarTopics: () => Promise.resolve([]),
}))
vi.mock('@/components/billing/PaywallBanner', () => ({
  PaywallBanner: () => null,
}))
vi.mock('@/components/billing/FreemiumQuotaBanner', () => ({
  FreemiumQuotaBanner: () => null,
}))
vi.mock('@/components/ui/AudioPlayer', () => ({ AudioPlayer: () => null }))
vi.mock('@/components/ui/VoiceRecorder', () => ({ VoiceRecorder: () => null }))
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }))
vi.mock('@/components/ui/WordTooltip', () => ({
  WordTooltip: () => null,
  useWordSave: () => ({
    selectedWord: null,
    tooltipPos: null,
    saveState: 'idle',
    handleTextSelection: vi.fn(),
    handleSaveWord: vi.fn(),
    dismissTooltip: mocks.dismissTooltip,
  }),
}))
vi.mock('@/components/ui/page-loading', () => ({ PageLoading: () => null }))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: () => null,
  getReviewPromptDismissal: () => ({ count: 0, lastDismissedAt: null }),
}))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: ReactNode }) => (
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
    content: {},
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

describe('LessonPage lesson loading and answer flow', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    mocks.completeLesson.mockReset()
    mocks.fetchStatus.mockReset()
    mocks.dismissTooltip.mockReset()
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

  it('rejects a malformed load payload and offers a retry', async () => {
    mockLessonLoad(jsonResponse({ lesson: lessonPayload.lesson }))

    render(<LessonPage />)

    expect(await screen.findByText('body')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'backToPlan' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
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
    const textarea = await screen.findByPlaceholderText('yourAnswer')
    fireEvent.change(textarea, { target: { value: 'Ich lerne Deutsch.' } })
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
})
