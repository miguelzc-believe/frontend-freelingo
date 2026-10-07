import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthStore, type User } from '@/store/auth'
import {
  fetchVoiceSettings,
  fetchVoiceStatus,
  isValidLlmBaseUrl,
  LlmSettingsApiError,
  normalizeLlmBaseUrl,
  saveVoiceSettings,
  testVoiceSettings,
  type TtsVoiceTestResult,
  type VoiceSettings,
  type VoiceSettingsInput,
} from '@/lib/voice-settings'

const DEFAULT_BASE_URL = 'https://omniroute.miguel-zapata.com/v1'
const controlClass =
  'border-fl-border bg-fl-bg text-fl-fg focus:border-fl-border-2 focus-visible:outline-fl-fg w-full border px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2'
const buttonClass =
  'border-fl-border text-fl-fg hover:bg-fl-surface-2 focus-visible:outline-fl-fg border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40'

interface Draft {
  baseUrl: string
  model: string
  apiKey: string
  voice: string
  speed: string
}

function draftFromSettings(kind: 'tts' | 'stt', saved: VoiceSettings): Draft {
  return {
    baseUrl: saved.base_url ?? DEFAULT_BASE_URL,
    model: saved.model ?? '',
    apiKey: '',
    voice: kind === 'tts' ? (saved.voice ?? 'alloy') : '',
    speed: kind === 'tts' ? String(saved.speed ?? 1) : '',
  }
}

export function VoiceProviderSettings() {
  const user = useAuthStore((state) => state.user)
  if (!user) return null
  return (
    <div className="border-fl-border bg-fl-surface space-y-5 border p-6">
      <VoiceProviderContent userId={user.id} role={user.role} />
    </div>
  )
}

function VoiceProviderContent({
  userId,
  role,
}: {
  userId: number
  role: User['role']
}) {
  const t = useTranslations('settings.ai.voice')
  return (
    <>
      <p className="text-fl-muted-2 font-mono text-sm leading-relaxed">
        {t('globalHint')}
      </p>
      {role === 'admin' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <VoiceServiceForm key={`tts-${userId}`} kind="tts" />
          <VoiceServiceForm key={`stt-${userId}`} kind="stt" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <VoiceServiceStatus kind="tts" />
          <VoiceServiceStatus kind="stt" />
        </div>
      )}
    </>
  )
}

function VoiceServiceStatus({ kind }: { kind: 'tts' | 'stt' }) {
  const t = useTranslations('settings.ai.voice')
  const [saved, setSaved] = useState<VoiceSettings | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function reload() {
      try {
        const next = await fetchVoiceStatus(kind)
        if (active) {
          setSaved(next)
          setFailed(false)
        }
      } catch {
        if (active) setFailed(true)
      }
    }
    void reload()
    window.addEventListener('freelingo:voice-settings-saved', reload)
    return () => {
      active = false
      window.removeEventListener('freelingo:voice-settings-saved', reload)
    }
  }, [attempt, kind])

  return (
    <section className="border-fl-border space-y-3 border p-4">
      <h3 className="text-fl-fg font-mono text-xs tracking-widest uppercase">
        {t(kind)}
      </h3>
      {failed && !saved ? (
        <div>
          <p role="alert" className="text-fl-error mb-3 font-mono text-sm">
            {t('loadFailed')}
          </p>
          <button
            className={buttonClass}
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            {t('retry')}
          </button>
        </div>
      ) : saved ? (
        saved.configured ? (
          <dl className="grid gap-2 font-mono text-sm">
            <div>
              <dt className="text-fl-muted-2">{t('model')}</dt>
              <dd className="text-fl-fg break-all">{saved.model}</dd>
            </div>
            {kind === 'tts' && (
              <div>
                <dt className="text-fl-muted-2">{t('voice')}</dt>
                <dd className="text-fl-fg">{saved.voice}</dd>
              </div>
            )}
            <dt className="text-fl-muted-2">{t('configured')}</dt>
          </dl>
        ) : (
          <p role="status" className="text-fl-muted-2 font-mono text-sm">
            {t('missing')}
          </p>
        )
      ) : (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {t('loading')}
        </p>
      )}
    </section>
  )
}

function VoiceServiceForm({ kind }: { kind: 'tts' | 'stt' }) {
  const t = useTranslations('settings.ai.voice')
  const [saved, setSaved] = useState<VoiceSettings | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [keyReusable, setKeyReusable] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [message, setMessage] = useState<{
    kind: 'success' | 'error'
    key: string
  } | null>(null)

  useEffect(() => {
    let active = true
    void fetchVoiceSettings(kind).then(
      (value) => {
        if (!active) return
        setSaved(value)
        setDraft(draftFromSettings(kind, value))
        setKeyReusable(value.has_api_key)
        setFailed(false)
      },
      () => {
        if (active) setFailed(true)
      }
    )
    return () => {
      active = false
    }
  }, [attempt, kind])

  function update(change: Partial<Draft>) {
    if (!draft) return
    const destinationChanged =
      change.baseUrl !== undefined &&
      normalizeLlmBaseUrl(change.baseUrl) !== normalizeLlmBaseUrl(draft.baseUrl)
    if (destinationChanged) setKeyReusable(false)
    setDraft({
      ...draft,
      ...change,
      ...(destinationChanged ? { apiKey: '' } : {}),
    })
    setMessage(null)
  }

  function validatedInput(): VoiceSettingsInput | null {
    if (!draft || !saved) return null
    if (!draft.model.trim()) {
      setMessage({ kind: 'error', key: 'required' })
      return null
    }
    if (!isValidLlmBaseUrl(draft.baseUrl.trim())) {
      setMessage({ kind: 'error', key: 'invalidUrl' })
      return null
    }
    if (!draft.apiKey.trim() && !keyReusable) {
      setMessage({ kind: 'error', key: 'keyRequired' })
      return null
    }
    if (
      kind === 'tts' &&
      (!draft.voice.trim() ||
        !Number.isFinite(Number(draft.speed)) ||
        Number(draft.speed) < 0.25 ||
        Number(draft.speed) > 4)
    ) {
      setMessage({ kind: 'error', key: 'invalidTts' })
      return null
    }
    return {
      base_url: normalizeLlmBaseUrl(draft.baseUrl) ?? DEFAULT_BASE_URL,
      model: draft.model.trim(),
      ...(draft.apiKey.trim() ? { api_key: draft.apiKey.trim() } : {}),
      ...(!keyReusable && saved.has_api_key && !draft.apiKey.trim()
        ? { clear_api_key: true }
        : {}),
      ...(kind === 'tts'
        ? { voice: draft.voice.trim(), speed: Number(draft.speed) }
        : {}),
    }
  }

  async function submit(action: 'save' | 'test') {
    if (busy) return
    const input = validatedInput()
    if (!input) return
    setBusy(action)
    setMessage(null)
    try {
      if (action === 'test') {
        if (kind === 'tts') {
          const result = await testVoiceSettings('tts', input)
          playTestAudio(result)
        } else {
          await testVoiceSettings('stt', input)
        }
        setMessage({ kind: 'success', key: 'testSuccess' })
      } else {
        const canonical = await saveVoiceSettings(kind, input)
        setSaved(canonical)
        setDraft(draftFromSettings(kind, canonical))
        setKeyReusable(canonical.has_api_key)
        setMessage({ kind: 'success', key: 'saveSuccess' })
      }
    } catch (error) {
      let key = action === 'test' ? 'testFailed' : 'saveFailed'
      if (error instanceof LlmSettingsApiError) {
        if (error.status === 403) key = 'adminRequired'
        else if (error.status === 422) key = 'validationFailed'
        else if (action === 'test' && error.status === 504) key = 'testTimeout'
      }
      setMessage({ kind: 'error', key })
    } finally {
      setBusy(null)
    }
  }

  if (failed) {
    return (
      <section className="border-fl-border space-y-3 border p-4">
        <h3 className="text-fl-fg font-mono text-xs tracking-widest uppercase">
          {t(kind)}
        </h3>
        <p role="alert" className="text-fl-error font-mono text-sm">
          {t('loadFailed')}
        </p>
        <button
          className={buttonClass}
          onClick={() => setAttempt((value) => value + 1)}
          type="button"
        >
          {t('retry')}
        </button>
      </section>
    )
  }
  if (!draft || !saved) {
    return (
      <section className="border-fl-border border p-4">
        <h3 className="text-fl-fg mb-3 font-mono text-xs tracking-widest uppercase">
          {t(kind)}
        </h3>
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {t('loading')}
        </p>
      </section>
    )
  }

  return (
    <section className="border-fl-border space-y-4 border p-4">
      <div>
        <h3 className="text-fl-fg font-mono text-xs tracking-widest uppercase">
          {t(kind)}
        </h3>
        <p className="text-fl-muted-3 mt-2 font-mono text-xs leading-relaxed">
          {t(kind === 'tts' ? 'ttsHint' : 'sttHint')}
        </p>
      </div>
      {!saved.configured && (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {t('missing')}
        </p>
      )}
      {saved.configured && (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {t('configured')}: {saved.model}
        </p>
      )}
      <form
        className="space-y-4"
        noValidate
        aria-busy={busy !== null}
        onSubmit={(event) => {
          event.preventDefault()
          void submit('save')
        }}
      >
        <fieldset
          className="space-y-4 disabled:opacity-60"
          disabled={busy !== null}
        >
          <label className="block space-y-2">
            <span className="text-fl-muted-2 font-mono text-xs">
              {t('baseUrl')}
            </span>
            <input
              aria-label={kind === 'tts' ? t('ttsBaseUrl') : t('sttBaseUrl')}
              className={controlClass}
              maxLength={2048}
              value={draft.baseUrl}
              onChange={(event) => update({ baseUrl: event.target.value })}
              autoComplete="off"
            />
            <span className="text-fl-muted-3 block font-mono text-xs">
              {t('baseUrlHint')}
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-fl-muted-2 font-mono text-xs">
              {t('model')}
            </span>
            <input
              aria-label={kind === 'tts' ? t('ttsModel') : t('sttModel')}
              className={controlClass}
              maxLength={200}
              value={draft.model}
              onChange={(event) => update({ model: event.target.value })}
              autoComplete="off"
            />
            <span className="text-fl-muted-3 block font-mono text-xs">
              {t(kind === 'tts' ? 'ttsModelHint' : 'sttModelHint')}
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-fl-muted-2 font-mono text-xs">
              {t('apiKey')}
            </span>
            <input
              aria-label={kind === 'tts' ? t('ttsApiKey') : t('sttApiKey')}
              className={controlClass}
              type="password"
              value={draft.apiKey}
              onChange={(event) => update({ apiKey: event.target.value })}
              autoComplete="new-password"
              spellCheck={false}
            />
            <span className="text-fl-muted-3 block font-mono text-xs">
              {t(keyReusable ? 'keySaved' : 'keyRequiredHint')}
            </span>
          </label>
          {kind === 'tts' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-fl-muted-2 font-mono text-xs">
                  {t('voice')}
                </span>
                <input
                  aria-label={t('ttsVoice')}
                  className={controlClass}
                  maxLength={100}
                  value={draft.voice}
                  onChange={(event) => update({ voice: event.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-fl-muted-2 font-mono text-xs">
                  {t('speed')}
                </span>
                <input
                  aria-label={t('ttsSpeed')}
                  className={controlClass}
                  type="number"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={draft.speed}
                  onChange={(event) => update({ speed: event.target.value })}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button className={buttonClass} type="submit">
              {busy === 'save' ? t('saving') : t('save')}
            </button>
            <button
              className={buttonClass}
              onClick={() => void submit('test')}
              type="button"
            >
              {busy === 'test' ? t('testing') : t('test')}
            </button>
          </div>
        </fieldset>
      </form>
      {busy && (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {t(busy === 'save' ? 'saving' : 'testing')}
        </p>
      )}
      {message && (
        <output
          role={message.kind === 'error' ? 'alert' : undefined}
          className={`block font-mono text-sm ${message.kind === 'error' ? 'text-fl-error' : 'text-fl-fg'}`}
        >
          {t(message.key)}
        </output>
      )}
    </section>
  )
}

function playTestAudio(result: TtsVoiceTestResult) {
  const binary = atob(result.audio_base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const url = URL.createObjectURL(
    new Blob([bytes], { type: result.content_type })
  )
  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  audio.onerror = () => URL.revokeObjectURL(url)
  void audio.play().catch(() => URL.revokeObjectURL(url))
}
