import { apiFetch } from '@/lib/api'

export const LLM_PROVIDERS = [
  'ollama',
  'openai',
  'anthropic',
  'deepseek',
  'custom',
] as const

export type LlmProvider = (typeof LLM_PROVIDERS)[number]

export interface LlmStatus {
  configured: boolean
  provider: string | null
  model: string | null
}

export interface LlmSettings extends LlmStatus {
  provider: LlmProvider | null
  base_url: string | null
  has_api_key: boolean
  max_tokens: number
  revision: number
}

export interface LlmSettingsInput {
  provider: LlmProvider
  model: string
  base_url: string | null
  api_key?: string | null
  clear_api_key?: boolean
  max_tokens?: number
}

export class LlmSettingsApiError extends Error {
  constructor(public readonly status: number) {
    super(`llm_settings_api_error_${status}`)
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new LlmSettingsApiError(response.status)
  return response.json() as Promise<T>
}

function safeSettings(data: LlmSettings): LlmSettings {
  return {
    configured: data.configured,
    provider: data.provider,
    model: data.model,
    base_url: data.base_url,
    has_api_key: data.has_api_key,
    max_tokens: data.max_tokens,
    revision: data.revision,
  }
}

export async function fetchLlmStatus(): Promise<LlmStatus> {
  const data = await parseOrThrow<LlmStatus>(
    await apiFetch('/api/llm-settings/status', { cache: 'no-store' })
  )
  return {
    configured: data.configured,
    provider: data.provider,
    model: data.model,
  }
}

export async function fetchLlmSettings(): Promise<LlmSettings> {
  return safeSettings(
    await parseOrThrow<LlmSettings>(
      await apiFetch('/api/admin/llm-settings', { cache: 'no-store' })
    )
  )
}

async function sendDraft(
  method: 'PUT' | 'POST',
  path: string,
  input: LlmSettingsInput
): Promise<Response> {
  return apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function saveLlmSettings(
  input: LlmSettingsInput
): Promise<LlmSettings> {
  const saved = safeSettings(
    await parseOrThrow<LlmSettings>(
      await sendDraft('PUT', '/api/admin/llm-settings', input)
    )
  )
  window.dispatchEvent(new Event('freelingo:llm-settings-saved'))
  return saved
}

export async function testLlmSettings(
  input: LlmSettingsInput
): Promise<{ ok: true }> {
  return parseOrThrow(
    await sendDraft('POST', '/api/admin/llm-settings/test', input)
  )
}

export function normalizeLlmBaseUrl(value: string | null): string | null {
  return value?.trim().replace(/\/+$/, '') || null
}

export function isValidLlmBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !value.includes('?') &&
      !value.includes('#')
    )
  } catch {
    return false
  }
}
