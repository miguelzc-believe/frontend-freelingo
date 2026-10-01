import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { mockApiFetch, mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockPush: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('plan=42') },
}))

// Stable reference: the page's useCallback depends on `t`, so a new function
// per render would re-trigger the question-loading effect in a loop.
const stableT = (key: string) => key

vi.mock('use-intl', () => ({
  useTranslations: () => stableT,
}))

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => searchParamsRef.current,
}))

vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))

import LevelTestPage from '@/app/(app)/assessment/level-test/page'

const questions = [
  {
    id: 'lt1',
    skill: 'grammar',
    difficulty: 'A2',
    question: 'Wann ___ er nach Hause?',
    options: ['kommt', 'kommen', 'kam', 'gekommen'],
    correct: 'kommt',
  },
  {
    id: 'lt2',
    skill: 'vocabulary',
    difficulty: 'A2',
    question: 'Das ___ steht in der Küche.',
    options: ['schnell', 'Brot', 'laufen', 'und'],
    correct: 'Brot',
  },
]

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockQuestions(status = 200) {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/assessment/level-test/questions/'))
      return status === 200
        ? jsonResponse({ plan_id: 42, cefr_level: 'A2', questions })
        : jsonResponse({}, status)
    if (url === '/api/assessment/level-test/submit')
      return jsonResponse({
        score: 1,
        recommendation: 'advance',
        next_level: 'B1',
      })
    throw new Error(`Unexpected apiFetch: ${url}`)
  })
}

async function confirmStart() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'startWarningConfirm' })
  )
}

async function answerAndAdvance(option: string, last = false) {
  fireEvent.click(
    await screen.findByRole('button', { name: new RegExp(option) })
  )
  fireEvent.click(screen.getByRole('button', { name: 'levelTest.confirm' }))
  fireEvent.click(
    screen.getByRole('button', {
      name: last ? /levelTest\.submit/ : /levelTest\.nextQuestion/,
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  searchParamsRef.current = new URLSearchParams('plan=42')
})

describe('LevelTestPage', () => {
  it('asks for confirmation before loading and cancel returns to the plan', () => {
    mockQuestions()
    render(<LevelTestPage />)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'startWarningMessageLevelTest'
    )
    expect(mockApiFetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(mockPush).toHaveBeenCalledWith('/plan')
  })

  it('rejects an invalid plan id after confirmation', async () => {
    searchParamsRef.current = new URLSearchParams('plan=abc')
    mockQuestions()
    render(<LevelTestPage />)
    await confirmStart()
    expect(await screen.findByText('levelTest.invalidPlan')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('shows an error when the questions fail to load', async () => {
    mockQuestions(500)
    render(<LevelTestPage />)
    await confirmStart()
    expect(await screen.findByText('levelTest.loadFailed')).toBeInTheDocument()
  })

  it('runs the quiz, submits and shows the advance recommendation', async () => {
    mockQuestions()
    render(<LevelTestPage />)
    await confirmStart()
    expect(
      await screen.findByText('Wann ___ er nach Hause?')
    ).toBeInTheDocument()
    await answerAndAdvance('kommt')
    expect(
      await screen.findByText('Das ___ steht in der Küche.')
    ).toBeInTheDocument()
    await answerAndAdvance('Brot', true)
    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/levelTest\.advanceLabel/)).toBeInTheDocument()
    const submitCall = mockApiFetch.mock.calls.find(
      ([url]) => url === '/api/assessment/level-test/submit'
    )
    expect(
      JSON.parse((submitCall?.[1] as { body: string }).body)
    ).toMatchObject({ plan_id: 42 })
    fireEvent.click(screen.getByRole('button', { name: /retake/ }))
    expect(mockPush).toHaveBeenCalledWith('/assessment')
  })

  it('shows an error when the submission fails', async () => {
    mockQuestions()
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/assessment/level-test/questions/'))
        return jsonResponse({ plan_id: 42, cefr_level: 'A2', questions })
      if (url === '/api/assessment/level-test/submit')
        return jsonResponse({}, 500)
      throw new Error(`Unexpected apiFetch: ${url}`)
    })
    render(<LevelTestPage />)
    await confirmStart()
    await answerAndAdvance('kommt')
    await answerAndAdvance('Brot', true)
    expect(
      await screen.findByText('levelTest.submitFailed')
    ).toBeInTheDocument()
  })
})
