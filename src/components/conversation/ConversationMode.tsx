import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'
import { mapUser } from '@/lib/mappers'
import {
  closeVoiceSession,
  ConversationApiError,
  fetchVoiceAudio,
  getVoiceGreeting,
  getVoiceSession,
  markVoiceActivity,
  sendVoiceTurn,
  startVoiceSession,
  type ChatContextItem,
  type VoiceSession,
  type VoiceTurnResult,
} from '@/lib/conversation-api'
import {
  createVoiceRecording,
  VoiceRecordingError,
  type VoiceRecording,
} from '@/lib/voice-recording'
import TranscriptBubble from './TranscriptBubble'
import SessionTimeoutBanner from './SessionTimeoutBanner'
import MessageAudioPlayer, { VoicePlayback } from './MessageAudioPlayer'
import { QuotaPill, TrialPremiumCta } from './VoiceSessionExtras'
import { WordTooltip, useWordSave } from '@/components/ui/WordTooltip'
import type { QuotaStatus } from '@/types/api'
import {
  ReviewPrompt,
  getReviewPromptDismissal,
} from '@/components/reviews/ReviewPrompt'
import { shouldShowVoiceReviewPrompt } from '@/lib/review-prompt-triggers'
import { MemorySavedToast } from '@/components/memory/MemorySavedToast'
import { useTransientToast } from '@/hooks/useTransientToast'

interface TranscriptEntry {
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

interface PendingTurn {
  blob: Blob
  attempts: number
  status: VoiceTurnResult['status'] | null
  delivery: 'pending' | 'resend' | 'rejected' | 'confirmed'
}

interface SessionRun {
  abort: AbortController
  session: VoiceSession | null
  urls: Set<string>
  turns: Map<string, PendingTurn>
  busy: boolean
  startedAt: number
  deadline: number
  ownerId: number | null
  ownerToken: string
  expiryCheckPending: boolean
}

type Status = 'ready' | 'connecting' | 'live' | 'sending' | 'ended' | 'error'

export default function ConversationMode({
  initialContext,
  autoStart,
  cefrLevel,
  targetLanguage,
  voiceTrialToken,
  voiceTrialDurationSeconds,
  trialMode,
  freemiumVoiceRemaining,
  freemiumVoiceLimit,
  conversationId,
  onClose,
}: Readonly<{
  initialContext?: ChatContextItem[] | undefined
  autoStart?: boolean | undefined
  cefrLevel?: string | null | undefined
  targetLanguage?: string | undefined
  voiceTrialToken?: string | undefined
  voiceTrialDurationSeconds?: number | undefined
  trialMode?: boolean | undefined
  freemiumVoiceRemaining?: number | undefined
  freemiumVoiceLimit?: number | undefined
  conversationId?: number | undefined
  onClose?: () => void
}>) {
  const t = useTranslations('conversation')
  const v = useTranslations('conversation.voiceMessages')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const userId = user?.id ?? null
  const language = targetLanguage ?? user?.target_language ?? 'en-GB'
  const scope = JSON.stringify([
    userId,
    language,
    voiceTrialToken ?? null,
    conversationId ?? null,
    trialMode ?? false,
  ])
  const [status, setStatus] = useState<Status>('ready')
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [warningSeconds, setWarningSeconds] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false)
  const [playback] = useState(() => new VoicePlayback())
  const runRef = useRef<SessionRun | null>(null)
  const autoStartedScopeRef = useRef<string | null>(null)
  const recorderRef = useRef<VoiceRecording | null>(null)
  const recordButtonRef = useRef<HTMLButtonElement | null>(null)
  const mountedRef = useRef(true)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const {
    visible: memoryToast,
    announcementId: memoryToastId,
    show: showMemoryToast,
  } = useTransientToast()
  const {
    selectedWord,
    tooltipPos,
    saveState,
    handleTextSelection,
    handleSaveWord,
    dismissTooltip,
  } = useWordSave()
  const visibleStarters = (t.raw('starters') as string[])
    .slice(0, 6)
    .sort((a, b) => a.localeCompare(b, locale))

  const refreshQuota = useCallback(() => {
    apiFetch('/api/auth/quota')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: QuotaStatus | null) => {
        if (mountedRef.current && data) setQuota(data)
      })
      .catch(() => {})
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    const id = useAuthStore.getState().user?.id
    try {
      const response = await apiFetch('/api/auth/me')
      if (!response.ok) return
      const data = await response.json()
      if (mountedRef.current && useAuthStore.getState().user?.id === id)
        setUser(mapUser(data, useAuthStore.getState().user))
    } catch {
      // Non-fatal: authorization and trial usage remain server-owned.
    }
  }, [setUser])

  const finish = useCallback(() => {
    const run = runRef.current
    runRef.current = null // Invalidate all pending capture, fetch and playback work first.
    run?.abort.abort()
    recorderRef.current?.cancel()
    recorderRef.current = null
    playback.blocked = true
    playback.stop()
    run?.urls.forEach((url) => URL.revokeObjectURL(url))
    run?.urls.clear()
    run?.turns.clear()
    if (run?.session)
      void closeVoiceSession(run.session.session_id, run.ownerToken)
        .then(() => {
          if (mountedRef.current) refreshQuota()
        })
        .catch(() => {})
    if (mountedRef.current) {
      setRecording(false)
      setWarningSeconds(null)
      setStatus('ended')
      setTranscript((entries) =>
        entries.map((entry) => ({
          ...entry,
          audio: undefined,
          audioError: entry.audio ? 'audioExpired' : entry.audioError,
        }))
      )
      dismissTooltip()
    }
    return run
  }, [dismissTooltip, playback, refreshQuota])

  // Changing account/language/trial invalidates the entire memory-only scope.
  // Token refresh alone does not: apiFetch always reads the latest bearer token.
  useEffect(() => {
    mountedRef.current = true
    setTranscript([])
    setRecording(false)
    setWarningSeconds(null)
    setErrorMsg(null)
    setStatus('ready')
    dismissTooltip()
    refreshQuota()
    return () => {
      mountedRef.current = false
      finish()
      // StrictMode replays setup after aborting this run but retains refs. Let
      // that setup start again; normal renders/token refresh do not clean up.
      autoStartedScopeRef.current = null
    }
  }, [scope, finish, refreshQuota, dismissTooltip])

  useEffect(() => {
    const run = runRef.current
    if (run && (!accessToken || userId !== run.ownerId)) finish()
    else if (run && accessToken) run.ownerToken = accessToken
  }, [accessToken, userId, finish])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    dismissTooltip()
  }, [transcript, dismissTooltip])

  function isCurrent(run: SessionRun): boolean {
    return (
      mountedRef.current && runRef.current === run && !run.abort.signal.aborted
    )
  }

  function messageFor(error: unknown): string {
    if (!(error instanceof ConversationApiError)) return t('errorConnection')
    if (error.status === 410) return v('sessionExpired')
    if (error.status === 404 || error.status === 401)
      return t('errorUnauthorized')
    if (error.status === 422) return t('errorTranscription')
    if (error.status === 409 || (error.status >= 500 && error.status !== 503))
      return t('errorConnection')
    const codes: Record<string, string> = {
      quota_exceeded_sessions: t('quotaExceededSessions'),
      quota_exceeded_time: t('quotaExceededTime'),
      quota_exceeded_tokens: t('quotaExceededTokens'),
      no_active_plan: tCommon('noActivePlan'),
      subscription_required: tCommon('noActivePlan'),
      services_disabled: t('errorServicesDisabled'),
      voice_services_unavailable: t('errorVoiceServicesUnavailable'),
    }
    return (
      codes[error.code] ??
      (error.status === 503
        ? t('errorVoiceServicesUnavailable')
        : tCommon('errorMessage'))
    )
  }

  function requestFailed(run: SessionRun, error: unknown) {
    if (!isCurrent(run)) return
    setErrorMsg(messageFor(error))
    if (
      error instanceof ConversationApiError &&
      [401, 402, 404, 410, 429, 503].includes(error.status)
    ) {
      finish()
      if (trialMode) void refreshCurrentUser()
      refreshQuota()
    } else {
      setStatus(run.session ? 'live' : 'error')
    }
  }

  function updateExpiry(
    run: SessionRun,
    result: { inactivity_expires_at: string; remaining_seconds?: number }
  ) {
    if (!run.session || !isCurrent(run)) return
    // Monotonic inactivity updates: a slower prior activity response must not
    // shorten a newer turn/activity extension.
    if (
      Date.parse(result.inactivity_expires_at) >
      Date.parse(run.session.inactivity_expires_at)
    )
      run.session.inactivity_expires_at = result.inactivity_expires_at
    // expires_at is the authoritative absolute cap. remaining_seconds is
    // rounded up by the server; subtracting it from this response's arrival
    // time could otherwise shorten the session during a slow provider call.
    if (result.remaining_seconds !== undefined && result.remaining_seconds <= 0)
      run.deadline = Math.min(run.deadline, Date.now())
  }

  function activity(run: SessionRun) {
    if (!run.session || !isCurrent(run)) return
    void markVoiceActivity(run.session.session_id, run.abort.signal)
      .then((result) => updateExpiry(run, result))
      .catch((error: unknown) => requestFailed(run, error))
  }

  function objectUrl(run: SessionRun, blob: Blob): string {
    const url = URL.createObjectURL(blob)
    run.urls.add(url)
    return url
  }

  async function applyResult(
    run: SessionRun,
    result: VoiceTurnResult,
    clientTurnId?: string
  ) {
    if (!isCurrent(run)) return
    updateExpiry(run, result)
    if (result.memory_updated) showMemoryToast()
    if (clientTurnId) {
      const pending = run.turns.get(clientTurnId)
      if (pending) {
        pending.status = result.status
        pending.attempts = result.stt_attempts
        pending.delivery = 'confirmed'
      }
      setTranscript((entries) =>
        entries.map((entry) =>
          entry.id === clientTurnId
            ? {
                ...entry,
                text:
                  result.user_text ??
                  (result.status === 'stt_failed' &&
                  entry.text === v('processing')
                    ? ''
                    : entry.text),
                turnStatus: result.status,
                attempts: pending?.attempts ?? result.stt_attempts,
                delivery: 'confirmed',
                deliveryError: undefined,
              }
            : entry
        )
      )
    }
    if (result.assistant_text !== null) {
      const id = `assistant-${result.turn_id}`
      setTranscript((entries) =>
        entries.some((entry) => entry.id === id)
          ? entries
          : [
              ...entries,
              {
                id,
                role: 'assistant',
                text: result.assistant_text!,
                cefrLevel: run.session?.cefr_level ?? cefrLevel ?? undefined,
              },
            ]
      )
      if (result.assistant_audio_url) {
        try {
          const blob = await fetchVoiceAudio(
            result.assistant_audio_url,
            run.abort.signal
          )
          if (!isCurrent(run)) return
          const audio = objectUrl(run, blob)
          setTranscript((entries) =>
            entries.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    audio,
                    autoPlay: result.status === 'complete',
                  }
                : entry
            )
          )
        } catch (error) {
          if (!isCurrent(run)) return
          if (
            error instanceof ConversationApiError &&
            [401, 410, 429, 503].includes(error.status)
          ) {
            requestFailed(run, error)
            return
          }
          setTranscript((entries) =>
            entries.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    audioError:
                      error instanceof ConversationApiError &&
                      [404, 410].includes(error.status)
                        ? 'audioExpired'
                        : 'playbackFailed',
                  }
                : entry
            )
          )
        }
      }
    }
    if (result.status === 'llm_failed' || result.status === 'tts_failed')
      setErrorMsg(v('replyFailed'))
  }

  async function start(topicContext?: ChatContextItem[]) {
    if (!accessToken || runRef.current) return
    const run: SessionRun = {
      abort: new AbortController(),
      session: null,
      urls: new Set(),
      turns: new Map(),
      busy: true,
      startedAt: Date.now(),
      deadline: Infinity,
      ownerId: userId,
      ownerToken: accessToken,
      expiryCheckPending: false,
    }
    runRef.current = run
    playback.blocked = false
    setTranscript([])
    dismissTooltip()
    setErrorMsg(null)
    setStatus('connecting')
    try {
      const session = await startVoiceSession(
        {
          target_language: language,
          context: topicContext ?? initialContext,
          voice_trial_token: voiceTrialToken,
          conversation_id: conversationId,
        },
        run.abort.signal
      )
      if (!isCurrent(run)) {
        // If the response arrives despite cancellation, close its known ID.
        // If it is lost entirely, request cancellation/server TTL bound lifetime.
        void closeVoiceSession(session.session_id, run.ownerToken).catch(
          () => {}
        )
        return
      }
      run.session = session
      run.deadline = Date.parse(session.expires_at)
      setStatus('sending')
      // Session creation does not generate speech and never acquires the mic.
      const greeting = await getVoiceGreeting(
        session.session_id,
        run.abort.signal
      )
      await applyResult(run, greeting)
    } catch (error) {
      requestFailed(run, error)
      if (isCurrent(run) && !run.session) {
        finish()
        setStatus('error')
      }
    } finally {
      run.busy = false
      if (isCurrent(run)) setStatus('live')
      refreshQuota()
    }
  }

  useEffect(() => {
    if (autoStart && accessToken && autoStartedScopeRef.current !== scope) {
      autoStartedScopeRef.current = scope
      void start()
    }
    // One start per current account/language/trial/conversation scope. Bearer
    // refresh cannot duplicate a start; recording always needs an explicit click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, accessToken, scope])

  function expire(run: SessionRun) {
    if (!isCurrent(run)) return
    finish()
    setErrorMsg(v('sessionExpired'))
    refreshQuota()
    if (trialMode) void refreshCurrentUser()
  }

  function reconcileExpiry(run: SessionRun) {
    if (!run.session || !isCurrent(run) || run.expiryCheckPending) return
    const session = run.session
    run.expiryCheckPending = true
    // GET does not extend inactivity. The backend may have refreshed it as
    // soon as the upload arrived, before its provider response reaches us.
    void getVoiceSession(session.session_id, run.abort.signal)
      .then((result) => {
        if (!isCurrent(run)) return
        updateExpiry(run, result)
        const remaining = Math.ceil(
          (Math.min(run.deadline, Date.parse(session.inactivity_expires_at)) -
            Date.now()) /
            1000
        )
        if (remaining <= 0) expire(run)
        else setWarningSeconds(remaining <= 60 ? remaining : null)
      })
      .catch((error: unknown) => {
        if (!isCurrent(run)) return
        if (error instanceof ConversationApiError && error.status === 410) {
          expire(run)
        } else if (
          error instanceof ConversationApiError &&
          [401, 402, 404, 429, 503].includes(error.status)
        ) {
          requestFailed(run, error)
        } else {
          // A failed read cannot prove inactivity expiry or finish a pending
          // provider request. The absolute deadline remains the upper bound.
          setErrorMsg(messageFor(error))
        }
      })
      .finally(() => {
        run.expiryCheckPending = false
      })
  }

  // Status reads never extend activity. Reconcile on returning to the tab so
  // suspended/background browser timers cannot preserve expired audio.
  useEffect(() => {
    const reconcile = () => {
      const run = runRef.current
      if (document.hidden || !run?.session || !isCurrent(run)) return
      if (run.deadline <= Date.now()) expire(run)
      else reconcileExpiry(run)
    }
    document.addEventListener('visibilitychange', reconcile)
    return () => document.removeEventListener('visibilitychange', reconcile)
    // The listener always checks run identity before applying any async result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, v, trialMode, refreshQuota, refreshCurrentUser])

  // No polling/activity heartbeat: timers use server UTC deadlines, and only
  // explicit record/play extends inactivity. A turn response also supplies TTL.
  useEffect(() => {
    if (status !== 'live' && status !== 'sending') return
    const timer = setInterval(() => {
      const run = runRef.current
      if (!run?.session) return
      const remaining = Math.ceil(
        (Math.min(run.deadline, Date.parse(run.session.inactivity_expires_at)) -
          Date.now()) /
          1000
      )
      if (remaining <= 0) {
        if (run.deadline <= Date.now()) expire(run)
        else reconcileExpiry(run)
      } else setWarningSeconds(remaining <= 60 ? remaining : null)
    }, 1000)
    return () => clearInterval(timer)
    // Both helpers validate the live run; tick reads mutable server deadlines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, finish, v, refreshQuota, trialMode, refreshCurrentUser])

  async function send(run: SessionRun, id: string, retry: boolean) {
    const turn = run.turns.get(id)
    if (
      !run.session ||
      !turn ||
      !isCurrent(run) ||
      run.busy ||
      recorderRef.current
    )
      return
    if (
      retry &&
      (turn.delivery !== 'confirmed' ||
        turn.status !== 'stt_failed' ||
        turn.attempts >= 3)
    )
      return
    if (!retry && turn.delivery !== 'pending' && turn.delivery !== 'resend')
      return
    // Reserve only the request, not an STT attempt: an ambiguous response may
    // already be cached server-side. Recover manually with retry=false first.
    run.busy = true
    turn.delivery = 'pending'
    setTranscript((entries) =>
      entries.map((entry) =>
        entry.id === id
          ? { ...entry, delivery: 'pending', deliveryError: undefined }
          : entry
      )
    )
    setStatus('sending')
    setErrorMsg(null)
    // The backend refreshes inactivity when it accepts a turn, before the
    // provider responds. Check its current deadline once the old one expires.
    try {
      const result = await sendVoiceTurn(
        run.session.session_id,
        turn.blob,
        id,
        retry,
        run.abort.signal
      )
      await applyResult(run, result, id)
    } catch (error) {
      if (!isCurrent(run)) return
      // Bad bytes cannot be recovered by resending. Network/500 and a busy
      // session remain manually recoverable using the original idempotency ID.
      turn.delivery =
        error instanceof ConversationApiError &&
        [413, 422].includes(error.status)
          ? 'rejected'
          : 'resend'
      setTranscript((entries) =>
        entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                text: entry.text === v('processing') ? '' : entry.text,
                delivery: turn.delivery,
                deliveryError: messageFor(error),
              }
            : entry
        )
      )
      requestFailed(run, error)
    } finally {
      run.busy = false
      if (isCurrent(run)) setStatus('live')
    }
  }

  async function stopRecording(run: SessionRun, recorder: VoiceRecording) {
    if (!isCurrent(run) || recorderRef.current !== recorder || run.busy) return
    run.busy = true
    setRecording(false)
    setStatus('sending')
    try {
      const blob = await recorder.stop()
      if (!isCurrent(run) || recorderRef.current !== recorder) return
      recorderRef.current = null
      playback.blocked = false
      run.busy = false
      if (!blob) {
        setErrorMsg(v('cancelled'))
        setStatus('live')
        return
      }
      const id = crypto.randomUUID()
      const audio = objectUrl(run, blob)
      run.turns.set(id, {
        blob,
        attempts: 0,
        status: null,
        delivery: 'pending',
      })
      // Show the local bytes before waiting for STT. Retries use this exact Blob.
      setTranscript((entries) => [
        ...entries,
        { id, role: 'user', text: v('processing'), audio, delivery: 'pending' },
      ])
      await send(run, id, false)
    } catch (error) {
      if (isCurrent(run)) {
        recorderRef.current = null
        playback.blocked = false
        run.busy = false
        setStatus('live')
        setErrorMsg(
          v(
            error instanceof VoiceRecordingError
              ? error.code
              : 'microphoneUnavailable'
          )
        )
      }
    }
  }

  function cancelRecording() {
    const run = runRef.current
    const recorder = recorderRef.current
    if (!run || !isCurrent(run) || run.busy || !recorder) return
    // Invalidate this capture before cleanup so late initialization/limit work
    // cannot send it or interfere with the next recording in the same session.
    recorderRef.current = null
    recorder.cancel()
    playback.blocked = false
    setRecording(false)
    setErrorMsg(null)
    recordButtonRef.current?.focus()
  }

  async function record() {
    const run = runRef.current
    if (!run?.session || !isCurrent(run) || run.busy || recorderRef.current)
      return
    playback.blocked = true
    playback.stop()
    setErrorMsg(null)
    setRecording(true)
    const recorder = createVoiceRecording(
      run.session.max_recording_seconds,
      () => {
        if (isCurrent(run) && recorderRef.current === recorder)
          void stopRecording(run, recorder)
      }
    )
    recorderRef.current = recorder
    activity(run)
    try {
      const started = await recorder.start()
      if (!started && isCurrent(run) && recorderRef.current === recorder) {
        recorderRef.current = null
        playback.blocked = false
        setRecording(false)
      }
    } catch (error) {
      if (!isCurrent(run) || recorderRef.current !== recorder) return
      recorderRef.current = null
      playback.blocked = false
      setRecording(false)
      setErrorMsg(
        v(
          error instanceof VoiceRecordingError
            ? error.code
            : 'microphoneUnavailable'
        )
      )
    }
  }

  function end() {
    const run = finish()
    if (!run) return
    if (trialMode) void refreshCurrentUser()
    if (
      shouldShowVoiceReviewPrompt(
        getReviewPromptDismissal(),
        Date.now() - run.startedAt
      )
    )
      setReviewPromptOpen(true)
    refreshQuota()
  }

  const active =
    status === 'connecting' || status === 'live' || status === 'sending'
  const busy = status === 'connecting' || status === 'sending'
  const label = recording
    ? v('recording')
    : busy
      ? v('sending')
      : active
        ? v('ready')
        : status === 'ended'
          ? t('sessionEnded')
          : v('ready')

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden p-4 md:p-6">
      <div className="border-fl-border mb-6 flex items-end justify-between border-b pb-4">
        <div>
          <p className="text-fl-label text-fl-muted-2 mb-1 font-mono tracking-widest uppercase">
            {t('subtitle')}
          </p>
          <h1 className="text-fl-fg font-mono text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
        </div>
        {onClose && (
          <button
            onClick={() => {
              end()
              onClose()
            }}
            className="text-fl-hint text-fl-muted-2 hover:text-fl-fg font-mono tracking-widest uppercase transition-colors"
          >
            ← {tCommon('back')}
          </button>
        )}
      </div>
      {trialMode && (
        <div className="border-fl-accent/40 bg-fl-surface text-fl-muted-1 mb-4 border px-4 py-3 text-center font-mono text-xs tracking-widest uppercase">
          {t('trialBanner', {
            minutes: Math.round((voiceTrialDurationSeconds ?? 300) / 60),
          })}
        </div>
      )}
      <MemorySavedToast visible={memoryToast} announcementId={memoryToastId} />
      <div className="mb-4 min-h-0 flex-1 space-y-3 overflow-y-auto px-2">
        {transcript.map((entry) => (
          <TranscriptBubble
            key={entry.id}
            role={entry.role}
            text={entry.text}
            userAvatar={user?.avatar}
            userInitial={(user?.displayName || user?.username || '?')[0]}
            languageCode={language}
            onPointerUp={
              entry.role === 'assistant'
                ? () =>
                    handleTextSelection(
                      entry.text,
                      entry.cefrLevel ??
                        runRef.current?.session?.cefr_level ??
                        cefrLevel ??
                        undefined
                    )
                : undefined
            }
          >
            {entry.audio && (
              <MessageAudioPlayer
                src={entry.audio}
                playback={playback}
                autoPlay={entry.autoPlay ?? false}
                disabled={recording}
                onActivity={() => {
                  const run = runRef.current
                  if (run) activity(run)
                }}
              />
            )}
            {entry.audioError && (
              <p role="status" className="text-fl-muted-2 font-mono text-xs">
                {v(entry.audioError)}
              </p>
            )}
            {entry.deliveryError && (
              <p role="status" className="text-fl-error font-mono text-xs">
                {entry.deliveryError}
              </p>
            )}
            {entry.delivery === 'resend' && active && (
              <button
                disabled={busy || recording}
                onClick={() => {
                  const run = runRef.current
                  if (run) void send(run, entry.id, false)
                }}
                className="border-fl-border mt-2 border px-3 py-2 font-mono text-xs disabled:opacity-40"
              >
                {tCommon('retry')}
              </button>
            )}
            {entry.turnStatus === 'stt_failed' &&
              entry.delivery === 'confirmed' && (
                <div className="text-fl-error font-mono text-xs" role="status">
                  <p>{v('transcriptionFailed')}</p>
                  {(entry.attempts ?? 1) < 3 && active ? (
                    <button
                      disabled={busy || recording}
                      onClick={() => {
                        const run = runRef.current
                        if (run) void send(run, entry.id, true)
                      }}
                      className="border-fl-border mt-2 border px-3 py-2 disabled:opacity-40"
                    >
                      {v('retry')} ·{' '}
                      {v('retryCount', {
                        count: Math.max(0, (entry.attempts ?? 1) - 1),
                        max: 2,
                      })}
                    </button>
                  ) : (
                    <p>{v('retryLimit')}</p>
                  )}
                </div>
              )}
          </TranscriptBubble>
        ))}
        <div ref={transcriptEndRef} />
      </div>
      {errorMsg && (
        <div
          role="alert"
          className="border-fl-error/40 bg-fl-surface text-fl-error mb-4 border px-4 py-3 font-mono text-xs"
        >
          {errorMsg}
        </div>
      )}
      {trialMode && status === 'ended' && <TrialPremiumCta />}
      {!trialMode && !active && (
        <div className="mb-4">
          <p className="text-fl-hint text-fl-muted-3 mb-3 text-center font-mono tracking-widest uppercase">
            {t('startersHint')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {visibleStarters.map((topic) => (
              <button
                key={topic}
                onClick={() =>
                  void start([
                    {
                      role: 'user',
                      content: `I'd like to practice ${language} by talking about ${topic}.`,
                    },
                  ])
                }
                className="text-fl-muted-1 border-fl-border hover:border-fl-border-2 hover:text-fl-fg border px-3 py-2 font-mono text-xs tracking-wide transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-4 pb-2">
        {warningSeconds !== null && (
          <div className="w-full">
            <SessionTimeoutBanner seconds={warningSeconds} />
          </div>
        )}
        {freemiumVoiceRemaining != null && freemiumVoiceLimit != null ? (
          <span
            className={`text-fl-label font-mono tracking-widest uppercase ${freemiumVoiceRemaining <= 0 ? 'text-red-500' : 'text-fl-muted-2'}`}
          >
            {t('freemiumVoiceRemaining', {
              remaining: freemiumVoiceRemaining,
              limit: freemiumVoiceLimit,
            })}
          </span>
        ) : quota && !trialMode ? (
          <QuotaPill quota={quota} />
        ) : null}
        <p
          role="status"
          className="text-fl-fg font-mono text-xs font-semibold tracking-wide uppercase"
        >
          {label}
        </p>
        {active ? (
          <>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                ref={recordButtonRef}
                disabled={busy}
                onClick={() => {
                  const run = runRef.current
                  const recorder = recorderRef.current
                  if (run && recorder) void stopRecording(run, recorder)
                  else void record()
                }}
                className="border-fl-border text-fl-fg hover:border-fl-border-2 border px-5 py-3 font-mono text-sm tracking-widest uppercase disabled:opacity-40"
              >
                {recording ? v('stopAndSend') : v('record')}
              </button>
              {recording && (
                <button
                  disabled={busy}
                  onClick={cancelRecording}
                  className="border-fl-border text-fl-muted-2 hover:border-fl-border-2 hover:text-fl-fg border px-5 py-3 font-mono text-sm tracking-widest uppercase disabled:opacity-40"
                >
                  {tCommon('cancel')}
                </button>
              )}
            </div>
            {runRef.current?.session && (
              <p className="text-fl-muted-3 font-mono text-xs">
                {v('recordingLimit', {
                  seconds: Math.min(
                    120,
                    runRef.current.session.max_recording_seconds
                  ),
                })}
              </p>
            )}
            <button
              onClick={end}
              className="text-fl-muted-2 hover:text-fl-fg border-fl-border border px-4 py-2 font-mono text-xs tracking-widest uppercase"
            >
              {v('endSession')}
            </button>
          </>
        ) : (
          !(trialMode && status === 'ended') && (
            <button
              onClick={() => void start()}
              className="bg-fl-accent text-fl-accent-fg px-5 py-3 font-mono text-sm tracking-widest uppercase"
            >
              {t(status === 'ready' ? 'start' : 'startNew')}
            </button>
          )
        )}
      </div>
      <ReviewPrompt
        open={reviewPromptOpen}
        onClose={() => setReviewPromptOpen(false)}
        onSubmitted={() => setReviewPromptOpen(false)}
      />
      {selectedWord && (
        <WordTooltip
          word={selectedWord}
          pos={tooltipPos}
          saveState={saveState}
          onSave={() => handleSaveWord()}
          onDismiss={dismissTooltip}
          labels={{
            saveWord: tCommon('saveWord'),
            wordSaved: tCommon('wordSaved'),
            wordAlreadySaved: tCommon('wordAlreadySaved'),
            wordSaveError: tCommon('wordSaveError'),
          }}
        />
      )}
    </div>
  )
}
