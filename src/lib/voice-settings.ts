import { apiFetch } from '@/lib/api'
import {
  isValidLlmBaseUrl,
  LlmSettingsApiError,
  normalizeLlmBaseUrl,
} from '@/lib/llm-settings'

export { LlmSettingsApiError, isValidLlmBaseUrl, normalizeLlmBaseUrl }

export interface VoiceSettings {
  configured: boolean
  base_url: string | null
  model: string | null
  has_api_key: boolean
  revision: number
  voice?: string
  speed?: number
}

export interface VoiceSettingsInput {
  base_url: string
  model: string
  api_key?: string
  clear_api_key?: boolean
  voice?: string
  speed?: number
}

export interface TtsVoiceTestResult {
  ok: true
  audio_base64: string
  content_type: 'audio/mpeg' | 'audio/wav'
}

export interface SttVoiceTestResult {
  ok: true
}

export type VoiceTestResult = TtsVoiceTestResult | SttVoiceTestResult

type VoiceKind = 'tts' | 'stt'

function path(kind: VoiceKind, admin = false) {
  return admin ? `/api/admin/${kind}-settings` : `/api/${kind}-settings/status`
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new LlmSettingsApiError(response.status)
  return response.json() as Promise<T>
}

export async function fetchVoiceSettings(
  kind: VoiceKind
): Promise<VoiceSettings> {
  const data = await parseOrThrow<VoiceSettings>(
    await apiFetch(path(kind, true), { cache: 'no-store' })
  )
  return {
    configured: data.configured,
    base_url: data.base_url,
    model: data.model,
    has_api_key: data.has_api_key,
    revision: data.revision,
    ...(kind === 'tts' ? { voice: data.voice, speed: data.speed } : {}),
  }
}

export async function fetchVoiceStatus(
  kind: VoiceKind
): Promise<VoiceSettings> {
  const data = await parseOrThrow<VoiceSettings>(
    await apiFetch(path(kind), { cache: 'no-store' })
  )
  return {
    configured: data.configured,
    base_url: null,
    model: data.model,
    has_api_key: false,
    revision: 0,
  }
}

async function sendDraft(
  kind: VoiceKind,
  method: 'PUT' | 'POST',
  test: boolean,
  input: VoiceSettingsInput
): Promise<Response> {
  return apiFetch(`${path(kind, true)}${test ? '/test' : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function saveVoiceSettings(
  kind: VoiceKind,
  input: VoiceSettingsInput
): Promise<VoiceSettings> {
  const data = await parseOrThrow<VoiceSettings>(
    await sendDraft(kind, 'PUT', false, input)
  )
  window.dispatchEvent(new Event('freelingo:voice-settings-saved'))
  return {
    configured: data.configured,
    base_url: data.base_url,
    model: data.model,
    has_api_key: data.has_api_key,
    revision: data.revision,
    ...(kind === 'tts' ? { voice: data.voice, speed: data.speed } : {}),
  }
}

export async function testVoiceSettings(
  kind: 'tts',
  input: VoiceSettingsInput
): Promise<TtsVoiceTestResult>
export async function testVoiceSettings(
  kind: 'stt',
  input: VoiceSettingsInput
): Promise<SttVoiceTestResult>
export async function testVoiceSettings(
  kind: VoiceKind,
  input: VoiceSettingsInput
): Promise<VoiceTestResult> {
  return parseOrThrow<VoiceTestResult>(
    await sendDraft(kind, 'POST', true, input)
  )
}
