import { useTranslations } from 'use-intl'
import type { VoiceTurnResult } from '@/lib/conversation-api'
import TranscriptBubble from './TranscriptBubble'
import MessageAudioPlayer, { type VoicePlayback } from './MessageAudioPlayer'

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  audio?: string | undefined
  audioError?: 'audioExpired' | 'playbackFailed' | undefined
  turnStatus?: VoiceTurnResult['status'] | undefined
  attempts?: number | undefined
  autoPlay?: boolean | undefined
  cefrLevel?: string | undefined
  delivery?: 'pending' | 'resend' | 'rejected' | 'confirmed' | undefined
  deliveryError?: string | undefined
}

function transcriptDescriptionId(entry: TranscriptEntry, id: string) {
  if (!entry.text) return undefined
  if (entry.role === 'user' && entry.delivery !== 'confirmed') return undefined
  if (entry.turnStatus === 'stt_failed') return undefined
  return id
}

function TranscriptionRetry({
  attempts,
  active,
  disabled,
  onRetry,
}: Readonly<{
  attempts: number
  active: boolean
  disabled: boolean
  onRetry: () => void
}>) {
  const v = useTranslations('conversation.voiceMessages')
  return (
    <div className="text-fl-error font-mono text-xs">
      <output className="block">{v('transcriptionFailed')}</output>
      {attempts < 3 && active ? (
        <button
          disabled={disabled}
          onClick={onRetry}
          className="border-fl-border mt-2 border px-3 py-2 disabled:opacity-40"
        >
          {v('retry')} ·{' '}
          {v('retryCount', { count: Math.max(0, attempts - 1), max: 2 })}
        </button>
      ) : (
        <output className="block">{v('retryLimit')}</output>
      )}
    </div>
  )
}

export default function ConversationMessage({
  entry,
  textId,
  userAvatar,
  userInitial,
  language,
  playback,
  recording,
  busy,
  active,
  onSelect,
  onActivity,
  onRetry,
}: Readonly<{
  entry: TranscriptEntry
  textId: string
  userAvatar?: string | null | undefined
  userInitial?: string | undefined
  language: string
  playback: VoicePlayback
  recording: boolean
  busy: boolean
  active: boolean
  onSelect: () => void
  onActivity: () => void
  onRetry: (retryTranscription: boolean) => void
}>) {
  const v = useTranslations('conversation.voiceMessages')
  const tCommon = useTranslations('common')
  return (
    <TranscriptBubble
      role={entry.role}
      text={entry.text}
      textId={textId}
      userAvatar={userAvatar}
      userInitial={userInitial}
      languageCode={language}
      onPointerUp={entry.role === 'assistant' ? onSelect : undefined}
    >
      {entry.audio && (
        <MessageAudioPlayer
          src={entry.audio}
          transcriptId={transcriptDescriptionId(entry, textId)}
          playback={playback}
          autoPlay={entry.autoPlay ?? false}
          disabled={recording}
          onActivity={onActivity}
        />
      )}
      {entry.audioError && (
        <output className="text-fl-muted-2 block font-mono text-xs">
          {v(entry.audioError)}
        </output>
      )}
      {entry.deliveryError && (
        <output className="text-fl-error block font-mono text-xs">
          {entry.deliveryError}
        </output>
      )}
      {entry.delivery === 'resend' && active && (
        <button
          disabled={busy || recording}
          onClick={() => onRetry(false)}
          className="border-fl-border mt-2 border px-3 py-2 font-mono text-xs disabled:opacity-40"
        >
          {tCommon('retry')}
        </button>
      )}
      {entry.turnStatus === 'stt_failed' && entry.delivery === 'confirmed' && (
        <TranscriptionRetry
          attempts={entry.attempts ?? 1}
          active={active}
          disabled={busy || recording}
          onRetry={() => onRetry(true)}
        />
      )}
    </TranscriptBubble>
  )
}
