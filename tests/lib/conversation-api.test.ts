import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeVoiceSession,
  fetchVoiceAudio,
  getVoiceGreeting,
  getVoiceSession,
  markVoiceActivity,
  sendVoiceTurn,
  startVoiceSession,
} from '@/lib/conversation-api'
import { float32ToWav } from '@/lib/audio'
import { blobBytes, generatedSamples } from '../helpers/voice-capture'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch: api }))
beforeEach(() =>
  api
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ session_id: 'id' }) })
)

describe('voice-message HTTP API', () => {
  it('starts separately from greeting and forwards abort signals and context', async () => {
    const signal = new AbortController().signal
    const input = {
      target_language: 'ja',
      context: [{ role: 'user' as const, content: 'hello' }],
      voice_trial_token: 'trial',
      conversation_id: 5,
    }
    await startVoiceSession(input, signal)
    expect(api).toHaveBeenCalledOnce()
    expect(api).toHaveBeenCalledWith('/api/conversation/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    })
    await getVoiceGreeting('id', signal)
    await getVoiceSession('id', signal)
    await markVoiceActivity('id', signal)
    expect(api.mock.calls.map(([url]) => url)).toEqual([
      '/api/conversation/sessions',
      '/api/conversation/sessions/id/greeting',
      '/api/conversation/sessions/id',
      '/api/conversation/sessions/id/activity',
    ])
  })

  it('uses the same generated WAV bytes and UUID for explicit retries; no automatic provider retry', async () => {
    const signal = new AbortController().signal
    const blob = new Blob([float32ToWav(generatedSamples(), 16000)], {
      type: 'audio/wav',
    })
    const id = crypto.randomUUID()
    api.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'stt_failed' }),
    })
    await sendVoiceTurn('session', blob, id, false, signal)
    await sendVoiceTurn('session', blob, id, true, signal)
    expect(api).toHaveBeenCalledTimes(2)
    const forms = api.mock.calls.map((call) => call[1].body as FormData)
    expect(forms.map((form) => form.get('client_turn_id'))).toEqual([id, id])
    expect(forms.map((form) => form.get('retry'))).toEqual(['false', 'true'])
    const bytes = await Promise.all(
      forms.map((form) => blobBytes(form.get('audio') as Blob))
    )
    expect(new Uint8Array(bytes[0]!)).toEqual(new Uint8Array(bytes[1]!))
    expect(api.mock.calls[0]?.[1].headers).toBeUndefined()
  })

  it.each([410, 429, 404, 503])(
    'preserves HTTP %s with standard detail codes',
    async (status) => {
      api.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ detail: { code: 'session_expired' } }),
      })
      await expect(
        getVoiceSession('id', new AbortController().signal)
      ).rejects.toMatchObject({ status, code: 'session_expired' })
      expect(api).toHaveBeenCalledOnce()
    }
  )

  it('authenticates same-origin audio fetches as blobs without caching', async () => {
    const blob = new Blob([float32ToWav(generatedSamples(), 16000)], {
      type: 'audio/wav',
    })
    api.mockResolvedValue({ ok: true, blob: async () => blob })
    const signal = new AbortController().signal
    expect(
      await fetchVoiceAudio(
        '/api/conversation/sessions/id/turns/turn/audio/assistant',
        signal
      )
    ).toBe(blob)
    expect(api).toHaveBeenCalledWith(
      '/api/conversation/sessions/id/turns/turn/audio/assistant',
      { signal, cache: 'no-store' }
    )
    await expect(
      fetchVoiceAudio('https://provider.invalid/audio', signal)
    ).rejects.toMatchObject({ code: 'invalid_audio_url' })
    await expect(fetchVoiceAudio('/api/auth/me', signal)).rejects.toMatchObject(
      { code: 'invalid_audio_url' }
    )
    expect(api).toHaveBeenCalledOnce()
  })

  it.each([
    '/api/conversation/sessions/id',
    '/api/conversation/sessions/id/close',
    '/api/conversation/sessions/id/turns/turn/audio/admin',
    '/api/conversation/sessions/id/turns/turn/audio/assistant?destination=other',
  ])('rejects non-audio or parameterized private URLs: %s', async (path) => {
    await expect(
      fetchVoiceAudio(path, new AbortController().signal)
    ).rejects.toMatchObject({
      code: 'invalid_audio_url',
    })
    expect(api).not.toHaveBeenCalled()
  })

  it('closes best-effort with an independent keepalive request', async () => {
    await closeVoiceSession('id')
    expect(api).toHaveBeenCalledWith('/api/conversation/sessions/id/close', {
      method: 'POST',
      keepalive: true,
    })
  })
})
