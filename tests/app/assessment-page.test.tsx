import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const { mockApiFetch, mockPush, mockReplace, mockLoadConfig } = vi.hoisted(
  () => ({
    mockApiFetch: vi.fn(),
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    mockLoadConfig: vi.fn(),
  })
)

// Stable reference: useCallback/useEffect dependencies in the pages rely on it.
const stableT = (key: string) => key

vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => stableT,
}))

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))

vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

import AssessmentPage from '@/app/(app)/assessment/page'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useLanguageStore } from '@/store/language'
import type { TargetLanguage } from '@/lib/target-languages'
import type { AssessmentQuestion } from '@/data/types'

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

const bank: AssessmentQuestion[] = [
  {
    id: 'q1',
    skill: 'grammar',
    difficulty: 'A2',
    question: 'Wir ___ nach Berlin gefahren.',
    options: ['haben', 'sind', 'werden', 'seid'],
    correct: 'sind',
  },
]

const evaluateResult = {
  cefr_level: 'B1',
  score: 0.5,
  skill_profile: { grammar: 0.5 },
  strengths: ['grammar'],
  weaknesses: ['vocabulary'],
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockApi(
  plan: unknown,
  completeStatus = 200,
  voiceTrialStatus = 200,
  questions: AssessmentQuestion[] = bank
) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url === '/api/study-plan/current')
      return plan ? jsonResponse(plan) : jsonResponse({}, 404)
    if (url.startsWith('/api/assessment/bank'))
      return jsonResponse({ questions })
    if (url === '/api/assessment/evaluate') return jsonResponse(evaluateResult)
    if (url === '/api/assessment/complete')
      return completeStatus === 200
        ? jsonResponse({ plan_id: 7, cefr_level: 'A1' })
        : jsonResponse({}, completeStatus)
    if (url === '/api/assessment/voice-trial')
      return voiceTrialStatus === 200
        ? jsonResponse({
            plan_id: 9,
            cefr_level: 'A2',
            voice_trial: {
              available: true,
              token: 'trial-token',
              duration_seconds: 300,
            },
          })
        : jsonResponse({}, voiceTrialStatus)
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

function completeRequestBody() {
  const call = mockApiFetch.mock.calls.find(
    ([url]) => url === '/api/assessment/complete'
  )
  expect(call).toBeDefined()
  return JSON.parse((call?.[1] as { body: string }).body) as unknown
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: 'token', user: null })
  useConfigStore.setState({
    stripeEnabled: false,
    loaded: true,
    load: mockLoadConfig,
  })
  useLanguageStore.setState({ activeLanguage: german })
})

describe('AssessmentPage', () => {
  it('loads config and shows the beginner gate when no plan exists', async () => {
    mockApi(null)
    render(<AssessmentPage />)
    expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /beginnerOption/ })
    ).toBeInTheDocument()
    expect(mockLoadConfig).toHaveBeenCalledTimes(1)
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/assessment/bank?language=de'
    )
  })

  it('shows the existing plan and lets the student retake from the gate', async () => {
    mockApi({ cefr_level: 'B2', created_at: '2024-01-15T00:00:00Z' })
    render(<AssessmentPage />)
    expect(await screen.findByText('B2')).toBeInTheDocument()
    expect(screen.getByText('alreadyHasPlan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retake' }))
    expect(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    ).toBeInTheDocument()
  })

  it('completes the beginner path and navigates to the new plan', async () => {
    mockApi(null)
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /beginnerOption/ })
    )
    fireEvent.click(await screen.findByRole('button', { name: /startMyPlan/ }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plan'))
    expect(completeRequestBody()).toMatchObject({
      cefr_level: 'A1',
      duration_weeks: 12,
      target_language: 'de',
    })
  })

  it('stays on the plan step instead of navigating when creation fails', async () => {
    mockApi(null, 500)
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /beginnerOption/ })
    )
    fireEvent.click(await screen.findByRole('button', { name: /startMyPlan/ }))
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/assessment/complete',
        expect.anything()
      )
    )
    expect(mockPush).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: /startMyPlan/ })
    ).toBeEnabled()
  })

  it('shows an error when the voice trial request fails', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: 1,
        username: 'Student',
        displayName: 'Student',
        role: 'user',
        conversation_max_duration: 900,
        conversation_inactivity_timeout: 300,
      },
    })
    mockApi({ cefr_level: 'B2', created_at: '2024-01-15T00:00:00Z' }, 200, 500)
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /voiceTrialStart/ })
    )
    expect(await screen.findByText(/errorMessage/)).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('offers the voice trial and hands it to the conversation page', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: 1,
        username: 'Student',
        displayName: 'Student',
        role: 'user',
        conversation_max_duration: 900,
        conversation_inactivity_timeout: 300,
      },
    })
    mockApi({ cefr_level: 'B2', created_at: '2024-01-15T00:00:00Z' })
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /voiceTrialStart/ })
    )
    expect(await screen.findByText('voiceTrialLabel')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /voiceTrialStart/ }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/conversation'))
    expect(
      JSON.parse(sessionStorage.getItem('assessment_voice_trial') ?? 'null')
    ).toMatchObject({ token: 'trial-token', durationSeconds: 300 })
  })

  it('runs the adaptive quiz, evaluates and completes from the result', async () => {
    mockApi(null)
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('startWarningMessage')
    fireEvent.click(screen.getByRole('button', { name: 'startWarningConfirm' }))
    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    expect(await screen.findByText('resultStep')).toBeInTheDocument()
    expect(screen.getAllByText('B1').length).toBeGreaterThan(0)
    expect(screen.getByText('50%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /createPlan/ }))
    fireEvent.click(await screen.findByRole('button', { name: /startMyPlan/ }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plan'))
    expect(completeRequestBody()).toMatchObject({ cefr_level: 'B1' })
  })

  it('keeps the learner at the gate when the question bank is empty', async () => {
    mockApi(null, 200, 200, [])
    render(<AssessmentPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    )
    fireEvent.click(screen.getByRole('button', { name: 'startWarningConfirm' }))

    expect(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    ).toBeInTheDocument()
    expect(screen.queryByText('step2')).not.toBeInTheDocument()
  })

  it('moves up after a correct streak and down after a wrong streak', async () => {
    const questions: AssessmentQuestion[] = [
      ...['a2-1', 'a2-2'].map((id) => ({
        ...bank[0]!,
        id,
        difficulty: 'A2' as const,
      })),
      ...['b1-1', 'b1-2'].map((id) => ({
        ...bank[0]!,
        id,
        difficulty: 'B1' as const,
      })),
      { ...bank[0]!, id: 'a1-1', difficulty: 'A1' },
    ]
    mockApi(null, 200, 200, questions)
    render(<AssessmentPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    )
    fireEvent.click(screen.getByRole('button', { name: 'startWarningConfirm' }))
    fireEvent.click(await screen.findByRole('button', { name: /sind/ }))
    fireEvent.click(await screen.findByRole('button', { name: /sind/ }))
    expect(await screen.findByText('B1')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    expect(await screen.findByText('A1')).toBeInTheDocument()
  })

  it('does not step down below A1', async () => {
    const questions: AssessmentQuestion[] = [
      { ...bank[0]!, id: 'a2-1', difficulty: 'A2' },
      { ...bank[0]!, id: 'a2-2', difficulty: 'A2' },
      { ...bank[0]!, id: 'a1-1', difficulty: 'A1' },
      { ...bank[0]!, id: 'a1-2', difficulty: 'A1' },
      { ...bank[0]!, id: 'a1-3', difficulty: 'A1' },
    ]
    mockApi(null, 200, 200, questions)
    render(<AssessmentPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /hasExperienceOption/ })
    )
    fireEvent.click(screen.getByRole('button', { name: 'startWarningConfirm' }))
    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    expect(
      await screen.findByRole('button', { name: /sind/ })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /haben/ }))
    fireEvent.click(await screen.findByRole('button', { name: /haben/ }))
    expect(await screen.findByText('A1')).toBeInTheDocument()
  })

  it('backs out of the beginner duration flow to the beginner gate', async () => {
    mockApi(null)
    render(<AssessmentPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: /beginnerOption/ })
    )
    fireEvent.click(await screen.findByRole('button', { name: /back/ }))

    expect(
      await screen.findByRole('button', { name: /beginnerOption/ })
    ).toBeInTheDocument()
  })
})
