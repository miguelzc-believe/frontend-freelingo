import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConversationMessage, {
  type TranscriptEntry,
} from '@/components/conversation/ConversationMessage'
import { VoicePlayback } from '@/components/conversation/MessageAudioPlayer'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

function setup(entry: TranscriptEntry, active = true, busy = false) {
  const onRetry = vi.fn()
  const onSelect = vi.fn()
  render(
    <ConversationMessage
      entry={entry}
      textId="message-text"
      language="ja"
      playback={new VoicePlayback()}
      recording={false}
      active={active}
      busy={busy}
      onActivity={vi.fn()}
      onRetry={onRetry}
      onSelect={onSelect}
    />
  )
  return { onRetry, onSelect }
}

const failed: TranscriptEntry = {
  id: 'turn',
  role: 'user',
  text: '',
  delivery: 'confirmed',
  turnStatus: 'stt_failed',
  attempts: 1,
}

describe('conversation message presentation', () => {
  it('keeps the retry button outside native status text and requests an STT retry', () => {
    const { onRetry } = setup(failed)
    const status = screen.getByText('transcriptionFailed')
    expect(status.tagName).toBe('OUTPUT')
    expect(status.querySelector('button')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /retry/ }))
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(true)
  })

  it.each([3, 4])(
    'does not offer STT retry after %s authoritative attempts',
    (attempts) => {
      setup({ ...failed, attempts })
      expect(screen.getByText('retryLimit').tagName).toBe('OUTPUT')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it('does not offer retry after the session ends', () => {
    setup(failed, false)
    expect(screen.getByText('retryLimit')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('recovers transport without requesting another STT attempt', () => {
    const { onRetry } = setup({ ...failed, delivery: 'resend' })
    expect(screen.queryByText('transcriptionFailed')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('disables retries while sending', () => {
    setup(failed, true, true)
    expect(screen.getByRole('button', { name: /retry/ })).toBeDisabled()
  })

  it('preserves selectable assistant text, language and its stable ID', () => {
    const { onSelect } = setup({
      id: 'reply',
      role: 'assistant',
      text: 'こんにちは',
    })
    const text = screen.getByText('こんにちは')
    expect(text).toHaveAttribute('id', 'message-text')
    expect(text).toHaveAttribute('lang', 'ja')
    fireEvent.pointerUp(text)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not select user text as assistant vocabulary', () => {
    const { onSelect } = setup({
      id: 'input',
      role: 'user',
      text: 'こんにちは',
    })
    fireEvent.pointerUp(screen.getByText('こんにちは'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
