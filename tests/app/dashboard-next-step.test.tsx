import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'

const { mockApiFetch, mockPush } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
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

vi.mock('@/components/tour/OnboardingTour', () => ({ default: () => null }))
vi.mock('@/components/whats-new/WhatsNew', () => ({ default: () => null }))
vi.mock('@/components/billing/SubscriptionPlanButtons', () => ({
  default: () => null,
}))

import DashboardPage from '@/app/(app)/dashboard/page'
import { useConfigStore } from '@/store/config'
import { useProgressStore } from '@/store/progress'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function todayPayload(overrides: Record<string, unknown>) {
  return {
    plan_id: 7,
    cefr_level: 'A1',
    lessons: [],
    progress_day: 0,
    total_days: 16,
    pending_count: 0,
    completion: {
      state: 'in_progress',
      score: null,
      recommendation: null,
      next_level: null,
    },
    ...overrides,
  }
}

function mockDashboard(
  payload: Record<string, unknown>,
  progress: Record<string, unknown> = {}
) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/api/progress/summary') {
      return Promise.resolve(jsonResponse(progress))
    }
    if (url === '/api/study-plan/today') {
      return Promise.resolve(jsonResponse(payload))
    }
    return Promise.resolve(jsonResponse({}, 404))
  })
}

function mockToday(payload: Record<string, unknown>) {
  mockDashboard(payload)
}

describe('dashboard end-of-plan next step', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockPush.mockReset()
    useConfigStore.setState({
      stripeEnabled: false,
      dashboardBanner: null,
    })
    useProgressStore.setState({
      streak: 0,
      xp: 0,
      skills: {},
      todayLessons: [],
      completedToday: [],
    })
  })

  it('preserves same-day lesson slots across reorder and persistence', async () => {
    const lessons = ['Slot A', 'Slot B'].map((title) => ({
      id: null,
      title,
      lesson_type: 'grammar',
      week: 1,
      day: 1,
      objectives: [],
      estimated_minutes: 25,
      is_completed: true,
    }))
    mockToday(todayPayload({ lessons }))
    render(<DashboardPage />)

    const slotA = (await screen.findByText('Slot A')).closest('div.border')
    const slotB = screen.getByText('Slot B').closest('div.border')
    expect(slotA).not.toBeNull()
    expect(slotB).not.toBeNull()
    expect(screen.getAllByText('lessonDone')).toHaveLength(2)
    const original = useProgressStore.getState().todayLessons

    act(() => {
      useProgressStore.setState({ todayLessons: [...original].reverse() })
    })
    expect(screen.getByText('Slot A').closest('div.border')).toBe(slotA)
    expect(screen.getByText('Slot B').closest('div.border')).toBe(slotB)

    act(() => {
      useProgressStore.setState({
        todayLessons: original.map((lesson, index) => ({
          ...lesson,
          id: index + 50,
        })),
      })
    })
    expect(screen.getByText('Slot A').closest('div.border')).toBe(slotA)
    expect(screen.getByText('Slot B').closest('div.border')).toBe(slotB)
    expect(screen.getAllByText('lessonDone')).toHaveLength(2)
  })

  it('offers the level test at the final plan position', async () => {
    mockToday(
      todayPayload({
        progress_day: 15,
        completion: {
          state: 'ready',
          score: null,
          recommendation: null,
          next_level: null,
        },
      })
    )

    render(<DashboardPage />)

    expect(
      (await screen.findAllByText('levelTestReady')).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText('allCaughtUp')).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'beginLevelTest' })
    expect(link).toHaveAttribute('href', '/assessment/level-test?plan=7')
  })

  it('shows the result and retake action after advancing', async () => {
    mockToday(
      todayPayload({
        progress_day: 15,
        completion: {
          state: 'taken',
          score: 0.82,
          recommendation: 'advance',
          next_level: 'A2',
        },
      })
    )

    render(<DashboardPage />)

    expect(
      (await screen.findAllByText('levelTestCompleted')).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('levelTestScoreLine')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'retake' })
    expect(link).toHaveAttribute('href', '/assessment')
  })

  it('routes to My Plan when the CEFR scale is exhausted', async () => {
    mockToday(
      todayPayload({
        progress_day: 15,
        completion: {
          state: 'taken',
          score: 0.9,
          recommendation: 'advance',
          next_level: null,
        },
      })
    )

    render(<DashboardPage />)

    expect(
      (await screen.findAllByText('levelTestCompleted')).length
    ).toBeGreaterThan(0)
    const links = await screen.findAllByRole('link', { name: 'goToMyPlan' })
    expect(links.some((link) => link.getAttribute('href') === '/plan')).toBe(
      true
    )
    expect(
      screen.queryByRole('link', { name: 'retake' })
    ).not.toBeInTheDocument()
  })

  it('routes to My Plan when the result recommends reinforcement', async () => {
    mockToday(
      todayPayload({
        progress_day: 15,
        completion: {
          state: 'taken',
          score: 0.4,
          recommendation: 'repeat',
          next_level: null,
        },
      })
    )

    render(<DashboardPage />)

    const links = await screen.findAllByRole('link', { name: 'goToMyPlan' })
    expect(links.some((link) => link.getAttribute('href') === '/plan')).toBe(
      true
    )
  })

  it('keeps the lesson next step while the plan is in progress', async () => {
    mockToday(
      todayPayload({
        lessons: [
          {
            id: 5,
            title: 'Lesson A',
            lesson_type: 'grammar',
            week: 1,
            day: 1,
            objectives: [],
            estimated_minutes: 25,
            is_completed: false,
          },
        ],
      })
    )

    render(<DashboardPage />)

    expect((await screen.findAllByText('Lesson A')).length).toBeGreaterThan(0)
    expect(screen.queryByText('levelTestReady')).not.toBeInTheDocument()
    const lessonLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/lesson/5')
    expect(lessonLinks.length).toBeGreaterThan(0)
  })

  it('invites learners without a plan to take an assessment', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/progress/summary'
          ? jsonResponse({ current_streak: 3, total_xp: 45 })
          : jsonResponse({}, 404)
      )
    )

    render(<DashboardPage />)

    expect(
      (await screen.findAllByText('startWithAssessment')).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('assessmentCreatesPlan')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'takeAssessmentArrow' })
    ).toHaveLength(2)
    expect(screen.getByText('3d')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('noExercisesYet')).toBeInTheDocument()
    expect(screen.getByText('noSkills')).toBeInTheDocument()
    expect(screen.getByText('planProgress')).toBeInTheDocument()
    expect(screen.getAllByText('startWithAssessment')).toHaveLength(3)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('shows plan, vocabulary, and performance progress', async () => {
    mockDashboard(
      todayPayload({
        progress_day: 4,
        total_days: 10,
        pending_count: 2,
        lessons: [
          {
            id: 21,
            title: 'Finished lesson',
            lesson_type: 'reading',
            week: 1,
            day: 1,
            objectives: [],
            estimated_minutes: 20,
            is_completed: false,
          },
          {
            id: 22,
            title: 'Current lesson',
            lesson_type: 'grammar',
            week: 1,
            day: 2,
            objectives: [],
            estimated_minutes: 30,
            is_completed: false,
          },
          {
            id: null,
            title: 'Completed without an id',
            lesson_type: 'vocabulary',
            week: 1,
            day: 3,
            objectives: [],
            estimated_minutes: 25,
            is_completed: true,
          },
        ],
      }),
      {
        current_streak: 2,
        total_xp: 120,
        total_lessons: 8,
        total_exercises: 10,
        exercises_correct: 8,
        accuracy: 0.8,
        vocabulary_level: 'A2',
        vocabulary_mastered: 30,
        vocabulary_total: 100,
        vocabulary_progress: 0.3,
        skills: { speaking: 0.9, grammar: 0.4, reading: 0.7 },
      }
    )
    useProgressStore.setState({ completedToday: [21] })

    render(<DashboardPage />)

    expect(await screen.findByText('dayProgress')).toBeInTheDocument()
    expect(screen.getAllByText('40%').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('5 / 10')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('vocabularyProgress')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('vocabularyWords')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('exerciseStats')).toBeInTheDocument()
    expect(screen.getByText('performanceNeedsPractice')).toBeInTheDocument()
    expect(screen.getByText('performanceInProgress')).toBeInTheDocument()
    expect(screen.getByText('performanceStrong')).toBeInTheDocument()
    expect(screen.getAllByText('lessonDone')).toHaveLength(2)
    expect(
      screen
        .getAllByRole('link', { name: 'startLesson' })
        .every((link) => link.getAttribute('href') === '/lesson/22')
    ).toBe(true)
    expect(screen.getByText('2 pendingLessons →')).toBeInTheDocument()
  })

  it('shows an announcement when today is complete', async () => {
    useConfigStore.setState({
      dashboardBanner: {
        revision: 4,
        translations: {
          en: {
            title: 'A dashboard update',
            subtitle: 'New this week',
            description: 'A short announcement for learners.',
          },
        },
      },
    })
    mockDashboard(
      todayPayload({
        pending_count: 3,
        lessons: [
          {
            id: 31,
            title: 'Already complete',
            lesson_type: 'grammar',
            week: 1,
            day: 1,
            objectives: [],
            estimated_minutes: 25,
            is_completed: true,
          },
        ],
      })
    )

    render(<DashboardPage />)

    expect(await screen.findByText('A dashboard update')).toBeInTheDocument()
    expect(
      screen.getByText('A short announcement for learners.')
    ).toBeInTheDocument()
    expect(screen.getByText('allCaughtUp')).toBeInTheDocument()
    expect(screen.getByText('pendingStillAvailable')).toBeInTheDocument()
    expect(screen.getByText('completedToday')).toBeInTheDocument()
    expect(screen.getByText('lessonDone')).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('link', { name: 'goToMyPlan' })
        .every((link) => link.getAttribute('href') === '/plan')
    ).toBe(true)
  })

  it('shows an empty day after the progress request fails', async () => {
    mockApiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/progress/summary'
          ? jsonResponse({}, 503)
          : jsonResponse(todayPayload({ lessons: [] }))
      )
    )

    render(<DashboardPage />)

    expect((await screen.findAllByText('allCaughtUp')).length).toBeGreaterThan(
      0
    )
    expect(screen.getByText('noPendingToday')).toBeInTheDocument()
    expect(screen.getByText('noExercisesYet')).toBeInTheDocument()
    expect(screen.getByText('noSkills')).toBeInTheDocument()
    expect(screen.queryByText('pendingLessons →')).not.toBeInTheDocument()
  })
})
