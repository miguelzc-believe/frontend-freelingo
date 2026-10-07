import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => mocks)

import {
  LlmSettingsApiError,
  testVoiceSettings,
  type VoiceSettingsInput,
} from '@/lib/voice-settings'

const input: VoiceSettingsInput = {
  base_url: 'https://voice.example/v1',
  model: 'audio-model',
  api_key: 'test-only-key',
  voice: 'alloy',
  speed: 1,
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('voice settings tests', () => {
  beforeEach(() => mocks.apiFetch.mockReset())

  it('returns generated TTS preview data without saving the draft', async () => {
    const result = {
      ok: true as const,
      audio_base64: 'bXAz',
      content_type: 'audio/mpeg' as const,
    }
    mocks.apiFetch.mockResolvedValue(response(result))

    await expect(testVoiceSettings('tts', input)).resolves.toEqual(result)
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/admin/tts-settings/test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    )
  })

  it('returns a generic STT connectivity success', async () => {
    mocks.apiFetch.mockResolvedValue(response({ ok: true }))

    await expect(testVoiceSettings('stt', input)).resolves.toEqual({ ok: true })
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/admin/stt-settings/test',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('does not parse error details that might contain secrets', async () => {
    const json = vi.fn()
    mocks.apiFetch.mockResolvedValue({ ok: false, status: 502, json })

    await expect(testVoiceSettings('tts', input)).rejects.toEqual(
      new LlmSettingsApiError(502)
    )
    expect(json).not.toHaveBeenCalled()
  })
})
