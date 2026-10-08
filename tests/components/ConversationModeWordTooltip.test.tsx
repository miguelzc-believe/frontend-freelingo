import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationMode from '@/components/conversation/ConversationMode'
import { useAuthStore } from '@/store/auth'
import { captureFixture, generatedSamples } from '../helpers/voice-capture'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))
vi.mock('use-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { raw: () => [] }),
}))
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/reviews/ReviewPrompt', () => ({
  ReviewPrompt: () => null,
  getReviewPromptDismissal: () => null,
}))
vi.mock('@/lib/review-prompt-triggers', () => ({
  shouldShowVoiceReviewPrompt: () => false,
}))

const session = {
  session_id: 'session',
  cefr_level: 'A2',
  max_recording_seconds: 120,
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  inactivity_expires_at: new Date(Date.now() + 180_000).toISOString(),
}
const turn = {
  turn_id: 'greeting',
  user_text: null,
  assistant_text: 'El perro corre',
  assistant_audio_url: null,
  status: 'complete',
  stt_attempts: 0,
  memory_updated: false,
  remaining_seconds: 600,
  inactivity_expires_at: session.inactivity_expires_at,
}
let capture: ReturnType<typeof captureFixture>

async function selectWord() {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    toString: () => 'perro',
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 30,
        height: 10,
      }),
    }),
    removeAllRanges: vi.fn(),
  } as unknown as Selection)
  fireEvent.pointerUp(screen.getByText('El perro corre'))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  await screen.findByText('El perro corre')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'record' })).toBeEnabled()
  )
}

beforeEach(() => {
  capture = captureFixture()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
  )
  api.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url === '/api/flashcards/from-word'
        ? { already_saved: false }
        : url === '/api/conversation/sessions' || url.endsWith('/activity')
          ? session
          : url.endsWith('/greeting')
            ? turn
            : url.endsWith('/turns')
              ? {
                  ...turn,
                  turn_id: 'next',
                  user_text: 'Ya veo',
                  assistant_text: 'Muy bien',
                }
              : null,
  }))
  useAuthStore.setState({ accessToken: 'tok', user: null })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('voice-message word tooltip', () => {
  it('saves vocabulary with the server session level instead of a stale prop, even after ending', async () => {
    const view = render(<ConversationMode targetLanguage="es" cefrLevel="C1" />)
    await start()
    view.rerender(<ConversationMode targetLanguage="es" cefrLevel="B2" />)
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    await selectWord()
    fireEvent.click(screen.getByRole('button', { name: 'saveWord' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/api/flashcards/from-word',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            word: 'perro',
            context: 'El perro corre',
            cefr_level: 'A2',
          }),
        })
      )
    )
  })

  it('keeps selectable assistant text and dismisses on a new message', async () => {
    render(<ConversationMode targetLanguage="es" />)
    await start()
    await selectWord()
    expect(screen.getByText('saveWord')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'record' }))
    await waitFor(() => expect(capture.nodes).toHaveLength(1))
    act(() =>
      capture.nodes[0]!.emit({ type: 'samples', samples: generatedSamples() })
    )
    fireEvent.click(screen.getByRole('button', { name: 'stopAndSend' }))
    await act(async () => capture.nodes[0]!.emit({ type: 'stopped' }))
    await screen.findByText('Muy bien')
    expect(screen.queryByText('saveWord')).toBeNull()
  })

  it('dismisses at end, retains text, then clears it on restart', async () => {
    render(<ConversationMode targetLanguage="es" />)
    await start()
    await selectWord()
    fireEvent.click(screen.getByRole('button', { name: 'endSession' }))
    expect(screen.queryByText('saveWord')).toBeNull()
    expect(screen.getByText('El perro corre')).toBeInTheDocument()
    await selectWord()
    expect(screen.getByText('saveWord')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'startNew' }))
    expect(screen.queryByText('saveWord')).toBeNull()
    expect(screen.queryByText('El perro corre')).toBeNull()
    await screen.findByText('El perro corre')
  })
})
