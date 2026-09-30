import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  translate: (key: string) => key,
  dismissTooltip: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations: () => mocks.translate,
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('@/store/language', () => ({
  useLanguageStore: (selector: (state: object) => unknown) =>
    selector({ activeLanguage: { code: 'en-GB' } }),
}))
vi.mock('@/store/config', () => ({
  useConfigStore: (selector: (state: object) => unknown) =>
    selector({ stripeEnabled: false }),
}))
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: object) => unknown) =>
    selector({ user: null }),
  isSubscribed: () => false,
  isFreemiumTrialActive: () => false,
}))
vi.mock('@/store/freemium', () => ({
  useFreemiumStore: (selector: (state: object) => unknown) =>
    selector({ fetchStatus: vi.fn(), decrement: vi.fn(), status: null }),
}))
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
vi.mock('@/components/ui/page-loading', () => ({
  PageLoading: ({ label }: { label?: string }) => (
    <div>{label ?? 'loading'}</div>
  ),
}))
vi.mock('@/components/billing/FreemiumQuotaBanner', () => ({
  FreemiumQuotaBanner: () => null,
}))
vi.mock('@/components/billing/PaywallBanner', () => ({
  PaywallBanner: () => null,
}))
vi.mock('@/components/billing/MaintenanceBanner', () => ({
  MaintenanceGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/pagination', () => ({ Pagination: () => null }))
vi.mock('@/components/ui/exercise-audio-player', () => ({
  ExerciseAudioPlayer: () => null,
}))
vi.mock('@/components/TargetLanguageText', () => ({
  TargetLanguageText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: () => null,
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowExerciseReviewPrompt: () => false,
}))

import ListeningPage from '@/app/(app)/listening/page'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listening exercise generation', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset()
    mocks.apiFetch.mockImplementation((url: string) => {
      if (url === '/api/listening/next') {
        return Promise.resolve(jsonResponse({ available: false }))
      }
      if (url === '/api/listening/generate') {
        return Promise.resolve(jsonResponse({}, 202))
      }
      if (url === '/api/listening/next?wait=true') {
        return Promise.resolve(jsonResponse({ available: false }))
      }
      return Promise.resolve(jsonResponse({}, 404))
    })
  })

  it('shows a localized retryable error when accepted generation returns no exercise', async () => {
    render(<ListeningPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'generate' }))

    expect(await screen.findByText('generationFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'generate' })).toBeEnabled()
    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/api/listening/next?wait=true',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })
})
