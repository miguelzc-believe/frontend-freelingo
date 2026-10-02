import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const { mockApiFetch, mockPush } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/components/ui/app-link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', { href: String(href), ...props }, children),
}))

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}))

vi.mock('@/store/language', () => ({
  useLanguageStore: (
    selector: (state: {
      activeLanguage: { code: string; name: string }
    }) => unknown
  ) => selector({ activeLanguage: { code: 'en-US', name: 'English' } }),
}))

import PlanPage from '@/app/(app)/plan/page'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const planPayload = {
  id: 7,
  cefr_level: 'A1',
  duration_weeks: 1,
  days_per_week: 2,
  current_unit: 'a1_unit_1',
  completion_test_taken: false,
  completion_test_score: null,
  completion_test_recommendation: null,
  generated_plan: {
    weekly_plan: [
      {
        week: 1,
        days: [
          {
            day: 1,
            title: 'Day 1 Lesson',
            lesson_type: 'grammar',
            unit_id: 'a1_unit_1',
          },
          {
            day: 2,
            title: 'Level A1 Completion Test',
            lesson_type: 'review',
            unit_id: 'completion-test',
          },
        ],
      },
    ],
  },
}

function mockPlan(
  completionState: 'in_progress' | 'ready' | 'taken' | 'unavailable',
  planOverrides: Record<string, unknown> = {},
  responses: {
    planStatus?: number
    competencies?: unknown
    today?: unknown
    pending?: unknown
    lessons?: unknown
    units?: unknown
  } = {}
) {
  const currentPlan = { ...planPayload, ...planOverrides }
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/api/study-plan/current') {
      return Promise.resolve(jsonResponse(currentPlan, responses.planStatus))
    }
    if (url === '/api/progress/competencies') {
      return Promise.resolve(jsonResponse(responses.competencies ?? []))
    }
    if (url === '/api/study-plan/today') {
      if (responses.today !== undefined) {
        return Promise.resolve(jsonResponse(responses.today))
      }
      if (completionState === 'unavailable') {
        return Promise.resolve(jsonResponse({}, 500))
      }
      return Promise.resolve(
        jsonResponse({
          lessons: [],
          completion: {
            state: completionState,
            score: null,
            recommendation: null,
            next_level: null,
          },
        })
      )
    }
    if (url === '/api/study-plan/pending-lessons') {
      return Promise.resolve(jsonResponse(responses.pending ?? []))
    }
    if (url === '/api/study-plan/lessons') {
      return Promise.resolve(jsonResponse(responses.lessons ?? []))
    }
    if (url.startsWith('/api/curriculum/')) {
      return Promise.resolve(
        jsonResponse(
          responses.units ?? [
            {
              id: 'a1_unit_1',
              level: 'A1',
              unit_number: 1,
              title: 'Unit One',
              default_weeks: 2,
              grammar_points: ['g1'],
              vocabulary_set_ids: ['v1'],
              lesson_types: ['grammar'],
              competency_checklist: ['c1'],
            },
          ]
        )
      )
    }
    return Promise.resolve(jsonResponse({}, 404))
  })
}

describe('My Plan level test node', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockPush.mockReset()
  })

  it('opens the real level test when the final position is reached', async () => {
    mockPlan('ready')

    render(<PlanPage />)

    expect(await screen.findByText('levelComplete')).toBeInTheDocument()
    const title = await screen.findByText('completionTestTitle')
    const cardButton = title.closest('button')
    expect(cardButton).not.toBeNull()
    fireEvent.click(cardButton as HTMLButtonElement)
    expect(mockPush).toHaveBeenCalledWith('/assessment/level-test?plan=7')
  })

  it('keeps the level test locked while the plan is in progress', async () => {
    mockPlan('in_progress')

    render(<PlanPage />)

    expect(await screen.findByText('completionTestTitle')).toBeInTheDocument()
    expect(screen.queryByText('levelComplete')).not.toBeInTheDocument()
    const title = screen.getByText('completionTestTitle')
    const cardButton = title.closest('button')
    expect(cardButton).toBeDisabled()
    fireEvent.click(cardButton as HTMLButtonElement)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the persisted result once the level test is taken', async () => {
    mockPlan('taken', {
      completion_test_taken: true,
      completion_test_score: 0.82,
      completion_test_recommendation: 'advance',
    })

    render(<PlanPage />)

    expect(await screen.findByText('levelTestResult')).toBeInTheDocument()
    expect(screen.queryByText('levelComplete')).not.toBeInTheDocument()
    const title = await screen.findByText('completionTestTitle')
    const cardButton = title.closest('button')
    expect(cardButton).not.toBeDisabled()
    fireEvent.click(cardButton as HTMLButtonElement)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('keeps the level test locked when the completion state cannot be loaded', async () => {
    mockPlan('unavailable')

    render(<PlanPage />)

    const title = await screen.findByText('completionTestTitle')
    const cardButton = title.closest('button')
    expect(cardButton).toBeDisabled()
    fireEvent.click(cardButton as HTMLButtonElement)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to assessment when no study plan exists', async () => {
    mockPlan('in_progress', {}, { planStatus: 404 })

    render(<PlanPage />)

    expect(await screen.findByText('noPlanTitle')).toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/assessment')
  })

  it('shows the no-plan state when loading the plan fails', async () => {
    mockPlan('in_progress', {}, { planStatus: 503 })

    render(<PlanPage />)

    expect(await screen.findByText('noPlanTitle')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('starts today’s lesson and opens it from the unit drawer', async () => {
    mockPlan(
      'in_progress',
      {},
      {
        competencies: [{ unit_id: 'a1_unit_1', score: 0.4 }],
        today: {
          lessons: [
            {
              id: 44,
              title: 'Day 1 Lesson',
              lesson_type: 'grammar',
              week: 1,
              day: 1,
              is_completed: false,
            },
          ],
        },
      }
    )

    render(<PlanPage />)

    const unitTitle = await screen.findByText('Unit One')
    fireEvent.click(unitTitle.closest('button') as HTMLButtonElement)
    expect(await screen.findByText('grammarCovered')).toBeInTheDocument()
    expect(screen.getByText('Day 1 Lesson')).toBeInTheDocument()
    const startButtons = screen.getAllByRole('button', { name: 'start →' })
    const drawerStartButton = startButtons.at(-1)
    expect(drawerStartButton).toBeDefined()
    if (!drawerStartButton) throw new Error('Drawer start button is missing')
    fireEvent.click(drawerStartButton)
    expect(mockPush).toHaveBeenCalledWith('/lesson/44')
  })

  it('resumes pending lessons and marks completed generated lessons for review', async () => {
    mockPlan(
      'in_progress',
      {},
      {
        pending: [
          {
            id: 51,
            title: 'Catch-up Lesson',
            lesson_type: 'reading',
            week_number: 1,
            day_number: 2,
          },
        ],
        lessons: [
          {
            id: 52,
            title: 'Day 1 Lesson',
            lesson_type: 'grammar',
            week_number: 1,
            day_number: 1,
            unit_id: 'a1_unit_1',
            is_completed: true,
          },
        ],
      }
    )

    render(<PlanPage />)

    expect(await screen.findByText('1 pendingLessons')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'resume' }))
    expect(mockPush).toHaveBeenCalledWith('/lesson/51')

    const unitTitle = await screen.findByText('Unit One')
    fireEvent.click(unitTitle.closest('button') as HTMLButtonElement)
    expect(await screen.findByText('Day 1 Lesson')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'reviewLesson' })
    ).toBeInTheDocument()
  })

  it('locks units whose prerequisite competency is incomplete', async () => {
    mockPlan(
      'in_progress',
      {},
      {
        competencies: { a1_unit_1: 0.5 },
        units: [
          {
            id: 'a1_unit_1',
            level: 'A1',
            unit_number: 1,
            title: 'Unit One',
            default_weeks: 2,
            grammar_points: ['g1'],
            vocabulary_set_ids: ['v1'],
            lesson_types: ['grammar'],
            competency_checklist: ['c1'],
          },
          {
            id: 'a1_unit_2',
            level: 'A1',
            unit_number: 2,
            title: 'Unit Two',
            default_weeks: 2,
            grammar_points: [],
            vocabulary_set_ids: [],
            lesson_types: ['reading'],
            prerequisite_unit: 'a1_unit_1',
            competency_checklist: [],
          },
        ],
      }
    )

    render(<PlanPage />)

    expect(await screen.findByText('Unit Two')).toBeInTheDocument()
    expect(screen.getByText('Unit Two').closest('button')).toBeDisabled()
  })
})
