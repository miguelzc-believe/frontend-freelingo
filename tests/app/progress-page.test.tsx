import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const { mockApiFetch, mockTranslations } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockTranslations: (key: string) => key,
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en-GB',
  useTranslations: () => mockTranslations,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mockApiFetch }))
vi.mock('@/data/curriculum', () => ({
  getCurriculumUnits: vi.fn(),
}))
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label }: { label?: string }) => <div>{label}</div>,
}))
vi.mock('@/components/plan/NoPlanBanner', () => ({
  default: () => <div>No study plan</div>,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import ProgressPage from '@/app/(app)/progress/page'
import { getCurriculumUnits } from '@/data/curriculum'
import { useLanguageStore } from '@/store/language'

const unit = {
  id: 'unit-1',
  unit_number: 1,
  title: 'Introductions',
  competency_checklist: ['Greet someone', 'Introduce yourself', 'Ask a name'],
}
const vocabSets = [
  {
    id: 'b1-greetings',
    level: 'B1',
    topic: 'Greetings',
    words: [{ word: 'hello' }, { word: 'world' }],
  },
  {
    id: 'a2-travel',
    level: 'A2',
    topic: 'Travel',
    words: [{ word: 'amiga' }],
  },
]

function response(data: unknown, ok = true) {
  return { ok, json: async () => data }
}

function mockPageData({
  plan = { id: 4, cefr_level: 'B1' },
  summary = null,
  competencies = [],
  flashcards = [],
  sets = vocabSets,
}: {
  plan?: unknown
  summary?: unknown
  competencies?: unknown
  flashcards?: unknown
  sets?: typeof vocabSets
} = {}) {
  mockApiFetch.mockImplementation(async (url: string) => {
    const data: Record<string, unknown> = {
      '/api/progress/summary': summary,
      '/api/progress/competencies': competencies,
      '/api/study-plan/current': plan,
      '/api/flashcards/all': flashcards,
    }
    if (url === '/api/vocabulary?language=es') return response({ sets })
    if (url === '/api/vocabulary?language=en-GB') return response({ sets: [] })
    if (!(url in data)) throw new Error(`Unexpected apiFetch: ${url}`)
    return response(
      data[url],
      url !== '/api/study-plan/current' || plan !== null
    )
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useLanguageStore.setState({ activeLanguage: null })
  vi.mocked(getCurriculumUnits).mockResolvedValue([unit] as never)
})

describe('ProgressPage', () => {
  it('keeps the loading state until summary requests settle', async () => {
    const finishRequests: (() => void)[] = []
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith('/api/vocabulary'))
        return Promise.resolve(response({ sets: [] }))
      return new Promise((resolve) => {
        finishRequests.push(() =>
          resolve(response(url.includes('current') ? null : []))
        )
      })
    })

    render(<ProgressPage />)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(finishRequests).toHaveLength(4))
    finishRequests.forEach((finish) => finish())
    expect(await screen.findByText('No study plan')).toBeInTheDocument()
  })

  it('uses the default language and shows the no-plan state', async () => {
    mockPageData({ plan: null })
    render(<ProgressPage />)

    expect(await screen.findByText('No study plan')).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/progress/summary')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/progress/competencies')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/study-plan/current')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/flashcards/all')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/vocabulary?language=en-GB')
    expect(getCurriculumUnits).not.toHaveBeenCalled()
  })

  it('renders progress metrics, competency states and matching mastered vocabulary', async () => {
    useLanguageStore.setState({
      activeLanguage: { code: 'es', name: 'Español' } as never,
    })
    mockPageData({
      summary: {
        total_xp: 1234,
        current_streak: 5,
        total_lessons: 8,
        total_exercises: 20,
        exercises_correct: 16,
        accuracy: 0.8,
        skills: { reading: 0.75, listening: 0.5 },
      },
      competencies: [
        { unit_id: 'unit-1', score: 0.5, mastered_count: 1, total_count: 2 },
      ],
      flashcards: [
        { id: 1, word: 'HELLO', repetitions: 2 },
        { id: 2, word: 'world', repetitions: 0 },
      ],
    })
    render(<ProgressPage />)

    expect(await screen.findByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('5 🔥')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Español · B1')).toBeInTheDocument()
    expect(await screen.findByText('Greet someone')).toBeInTheDocument()
    expect(screen.getByText('Introduce yourself')).toBeInTheDocument()
    expect(screen.getByText('Ask a name')).toBeInTheDocument()
    expect(screen.getByText('✅')).toBeInTheDocument()
    expect(screen.getAllByText('🔄')).toHaveLength(1)
    expect(screen.getByText('⬜')).toBeInTheDocument()
    expect(
      screen.getByText('Introductions').closest('div.border-fl-border')
        ?.textContent
    ).toContain('1/3 mastered')
    expect(screen.getByText('reading')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Greetings')).toBeInTheDocument()
    expect(screen.queryByText('Travel')).not.toBeInTheDocument()
    expect(screen.getByText('Greetings').parentElement?.textContent).toContain(
      '1/2'
    )
    expect(getCurriculumUnits).toHaveBeenCalledWith('B1', 'es')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/vocabulary?language=es')

    fireEvent.click(screen.getByRole('button', { name: 'allLevels' }))
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(
      screen.getByText('Introductions').closest('div.border-fl-border')
        ?.textContent
    ).toContain('1/3 mastered')
    fireEvent.click(screen.getByRole('button', { name: 'currentLevelOnly' }))
    expect(screen.queryByText('Travel')).not.toBeInTheDocument()
  })

  it('keeps duplicate checklist occurrences and their ordinal statuses across vocabulary visibility changes', async () => {
    useLanguageStore.setState({
      activeLanguage: { code: 'es', name: 'Español' } as never,
    })
    vi.mocked(getCurriculumUnits).mockResolvedValue([
      { ...unit, competency_checklist: ['Repeated', 'Repeated', 'Repeated'] },
    ] as never)
    mockPageData({
      competencies: [
        { unit_id: 'unit-1', score: 0.5, mastered_count: 1, total_count: 2 },
      ],
    })
    render(<ProgressPage />)
    const rows = (await screen.findAllByText('Repeated')).map((node) =>
      node.closest('li')
    )
    expect(new Set(rows).size).toBe(3)
    expect(rows.map((row) => row?.textContent)).toEqual([
      '✅Repeated',
      '🔄Repeated50%',
      '⬜Repeated',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'allLevels' }))
    expect(screen.getByText('Travel')).toBeInTheDocument()
    screen
      .getAllByText('Repeated')
      .forEach((node, ordinal) =>
        expect(node.closest('li')).toBe(rows[ordinal])
      )
    expect(rows.map((row) => row?.textContent)).toEqual([
      '✅Repeated',
      '🔄Repeated50%',
      '⬜Repeated',
    ])
  })

  it('offers the plan link when curriculum units have no competency records', async () => {
    mockPageData({ competencies: [] })
    render(<ProgressPage />)

    expect(await screen.findByText('noCompetencies')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'goToMyPlan' })).toHaveAttribute(
      'href',
      '/plan'
    )
  })
})
