import { apiFetch } from '@/lib/api'

export interface ChatContextItem {
  role: 'user' | 'assistant'
  content: string
}

export interface VoiceSession {
  session_id: string
  conversation_id: number
  target_language: string
  cefr_level: string
  expires_at: string
  inactivity_expires_at: string
  max_recording_seconds: number
}

export interface VoiceSessionStatus extends VoiceSession {
  remaining_seconds: number
}

export interface VoiceTurnResult {
  turn_id: string
  user_text: string | null
  assistant_text: string | null
  user_audio_url: string | null
  assistant_audio_url: string | null
  status: 'complete' | 'stt_failed' | 'llm_failed' | 'tts_failed'
  stt_attempts: number
  memory_updated: boolean
  remaining_seconds: number
  inactivity_expires_at: string
}

export interface StartVoiceSession {
  target_language?: string | undefined
  context?: ChatContextItem[] | undefined
  voice_trial_token?: string | undefined
  conversation_id?: number | undefined
}

export class ConversationApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code)
    this.name = 'ConversationApiError'
  }
}

async function checked(response: Response): Promise<Response> {
  if (response.ok) return response
  const body = (await response.json().catch(() => null)) as {
    detail?: string | { code?: string }
  } | null
  const detail = body?.detail
  throw new ConversationApiError(
    response.status,
    typeof detail === 'string' ? detail : (detail?.code ?? 'unknown')
  )
}

async function json<T>(url: string, options: RequestInit): Promise<T> {
  const response = await checked(await apiFetch(url, options))
  return (await response.json()) as T
}

function sessionPath(id: string): string {
  return `/api/conversation/sessions/${encodeURIComponent(id)}`
}

export function startVoiceSession(
  input: StartVoiceSession,
  signal: AbortSignal
): Promise<VoiceSession> {
  return json('/api/conversation/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
}

export function getVoiceGreeting(
  id: string,
  signal: AbortSignal
): Promise<VoiceTurnResult> {
  return json(`${sessionPath(id)}/greeting`, { method: 'POST', signal })
}

export function sendVoiceTurn(
  id: string,
  audio: Blob,
  clientTurnId: string,
  retry: boolean,
  signal: AbortSignal
): Promise<VoiceTurnResult> {
  const body = new FormData()
  body.append('audio', audio, 'recording.wav')
  body.append('client_turn_id', clientTurnId)
  body.append('retry', String(retry))
  return json(`${sessionPath(id)}/turns`, { method: 'POST', body, signal })
}

export function getVoiceSession(
  id: string,
  signal: AbortSignal
): Promise<VoiceSessionStatus> {
  return json(sessionPath(id), { method: 'GET', signal, cache: 'no-store' })
}

export function markVoiceActivity(
  id: string,
  signal: AbortSignal
): Promise<VoiceSessionStatus> {
  return json(`${sessionPath(id)}/activity`, { method: 'POST', signal })
}

export async function closeVoiceSession(
  id: string,
  token: string
): Promise<void> {
  // Use the session owner's bearer captured in memory, not apiFetch's current
  // account (or its refresh cookie). Logout and account switches can occur
  // before the effect cleaning up this session runs. A failed close remains
  // bounded by the server TTL.
  await checked(
    await fetch(`${sessionPath(id)}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit',
      keepalive: true,
    })
  )
}

export async function fetchVoiceAudio(
  path: string,
  signal: AbortSignal
): Promise<Blob> {
  const url = new URL(path, window.location.origin)
  // Never send bearer credentials to a provider URL or assign authenticated
  // endpoints to <audio>. Only same-origin conversation audio is accepted.
  const segments = url.pathname.split('/')
  if (
    url.origin !== window.location.origin ||
    url.search !== '' ||
    segments.length !== 9 ||
    segments[0] !== '' ||
    segments[1] !== 'api' ||
    segments[2] !== 'conversation' ||
    segments[3] !== 'sessions' ||
    !segments[4] ||
    segments[5] !== 'turns' ||
    !segments[6] ||
    segments[7] !== 'audio' ||
    (segments[8] !== 'user' && segments[8] !== 'assistant')
  ) {
    throw new ConversationApiError(400, 'invalid_audio_url')
  }
  const response = await checked(
    await apiFetch(`${url.pathname}${url.search}`, {
      signal,
      cache: 'no-store',
    })
  )
  return response.blob()
}
