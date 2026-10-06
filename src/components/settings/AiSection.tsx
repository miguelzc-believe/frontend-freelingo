import { useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthStore } from '@/store/auth'
import { useLlmStatus } from '@/hooks/useLlmStatus'
import {
  fetchLlmSettings,
  isValidLlmBaseUrl,
  LLM_PROVIDERS,
  LlmSettingsApiError,
  normalizeLlmBaseUrl,
  saveLlmSettings,
  testLlmSettings,
  type LlmProvider,
  type LlmSettings,
  type LlmSettingsInput,
} from '@/lib/llm-settings'

const inputClass =
  'border-fl-border bg-fl-bg text-fl-fg focus:border-fl-border-2 focus-visible:outline-fl-fg w-full border px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2'
const buttonClass =
  'border-fl-border text-fl-fg hover:bg-fl-surface-2 focus-visible:outline-fl-fg border px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40'

export function AiSection() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return (
    <div className="border-fl-border bg-fl-surface space-y-4 border p-6">
      {user.role === 'admin' ? (
        <AdminAiSettings key={user.id} />
      ) : (
        <ReadonlyAiSettings key={user.id} />
      )}
    </div>
  )
}

function ReadonlyAiSettings() {
  const t = useTranslations('settings.ai')
  const tCommon = useTranslations('common')
  const { status, error, retry } = useLlmStatus(true)
  return (
    <>
      <p className="text-fl-muted-2 font-mono text-sm">{t('readonly')}</p>
      {error ? (
        <div>
          <p role="alert" className="text-fl-error mb-3 font-mono text-sm">
            {t('loadFailed')}
          </p>
          <button type="button" onClick={retry} className={buttonClass}>
            {tCommon('retry')}
          </button>
        </div>
      ) : status ? (
        status.configured ? (
          <dl className="grid gap-3 font-mono text-sm sm:grid-cols-2">
            <div>
              <dt className="text-fl-muted-2">{t('provider')}</dt>
              <dd className="text-fl-fg mt-1 break-all">{status.provider}</dd>
            </div>
            <div>
              <dt className="text-fl-muted-2">{t('model')}</dt>
              <dd className="text-fl-fg mt-1 break-all">{status.model}</dd>
            </div>
          </dl>
        ) : (
          <p role="status" className="text-fl-fg font-mono text-sm">
            {t('missing')}
          </p>
        )
      ) : (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {tCommon('loading')}
        </p>
      )}
    </>
  )
}

interface Draft {
  provider: LlmProvider | ''
  model: string
  baseUrl: string
  apiKey: string
  maxTokens: string
}

function draftFromSettings(settings: LlmSettings): Draft {
  return {
    provider: settings.provider ?? '',
    model: settings.model ?? '',
    baseUrl: settings.base_url ?? '',
    apiKey: '',
    maxTokens: String(settings.max_tokens),
  }
}

function AdminAiSettings() {
  const t = useTranslations('settings.ai')
  const tCommon = useTranslations('common')
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [keyReusable, setKeyReusable] = useState(false)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [message, setMessage] = useState<{
    kind: 'success' | 'error'
    key: string
  } | null>(null)

  useEffect(() => {
    let active = true
    setLoadFailed(false)
    async function load() {
      try {
        const canonical = await fetchLlmSettings()
        if (!active) return
        setSettings(canonical)
        setDraft(draftFromSettings(canonical))
        setKeyReusable(canonical.has_api_key)
      } catch {
        if (active) setLoadFailed(true)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [attempt])

  function updateDraft(change: Partial<Draft>) {
    if (!draft) return
    const providerChanged =
      change.provider !== undefined && change.provider !== draft.provider
    const identityChanged =
      providerChanged ||
      (change.baseUrl !== undefined &&
        normalizeLlmBaseUrl(change.baseUrl) !==
          normalizeLlmBaseUrl(draft.baseUrl))
    if (identityChanged) setKeyReusable(false)
    setDraft({
      ...draft,
      ...change,
      ...(providerChanged ? { baseUrl: '' } : {}),
      ...(identityChanged ? { apiKey: '' } : {}),
    })
    setMessage(null)
  }

  function validatedInput(): LlmSettingsInput | null {
    if (!draft || !settings) return null
    let error: string | null = null
    const baseUrl = normalizeLlmBaseUrl(draft.baseUrl)
    const needsKey = ['openai', 'anthropic', 'deepseek'].includes(
      draft.provider
    )
    if (!draft.provider || !draft.model.trim()) error = 'requiredFields'
    else if (
      (draft.provider === 'custom' && !baseUrl) ||
      (draft.baseUrl.trim() && !isValidLlmBaseUrl(draft.baseUrl.trim()))
    )
      error = 'invalidUrl'
    else if (needsKey && !draft.apiKey.trim() && !keyReusable)
      error = 'keyRequired'
    else if (
      draft.provider === 'anthropic' &&
      draft.maxTokens.trim() &&
      (!Number.isSafeInteger(Number(draft.maxTokens)) ||
        Number(draft.maxTokens) < 1 ||
        Number(draft.maxTokens) > 131072)
    )
      error = 'invalidMaxTokens'
    if (error || !draft.provider) {
      setMessage({ kind: 'error', key: error ?? 'requiredFields' })
      return null
    }
    return {
      provider: draft.provider,
      model: draft.model.trim(),
      base_url: baseUrl,
      ...(draft.apiKey.trim() ? { api_key: draft.apiKey.trim() } : {}),
      ...(!keyReusable && settings.has_api_key && !draft.apiKey.trim()
        ? { clear_api_key: true }
        : {}),
      ...(draft.provider === 'anthropic' && draft.maxTokens.trim()
        ? { max_tokens: Number(draft.maxTokens) }
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
        await testLlmSettings(input)
        setMessage({ kind: 'success', key: 'testSuccess' })
      } else {
        const canonical = await saveLlmSettings(input)
        setSettings(canonical)
        setDraft(draftFromSettings(canonical))
        setKeyReusable(canonical.has_api_key)
        setMessage({ kind: 'success', key: 'saveSuccess' })
      }
    } catch (error) {
      let key = action === 'save' ? 'saveFailed' : 'testFailed'
      if (error instanceof LlmSettingsApiError) {
        if (error.status === 422) key = 'validationFailed'
        else if (error.status === 403) key = 'adminRequired'
        else if (action === 'test' && error.status === 504) key = 'testTimeout'
      }
      setMessage({ kind: 'error', key })
    } finally {
      setBusy(null)
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit('save')
  }

  return (
    <>
      <p className="text-fl-muted-2 font-mono text-sm leading-relaxed">
        {t('globalHint')}
      </p>
      {loadFailed ? (
        <div>
          <p role="alert" className="text-fl-error mb-3 font-mono text-sm">
            {t('loadFailed')}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={buttonClass}
          >
            {tCommon('retry')}
          </button>
        </div>
      ) : !draft || !settings ? (
        <p role="status" className="text-fl-muted-2 font-mono text-sm">
          {tCommon('loading')}
        </p>
      ) : (
        <form onSubmit={handleSave} noValidate aria-busy={busy !== null}>
          {!settings.configured && (
            <p className="text-fl-fg mb-4 font-mono text-sm" role="status">
              {t('missing')}
            </p>
          )}
          <fieldset
            disabled={busy !== null}
            className="space-y-4 disabled:opacity-60"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="ai-provider"
                  className="text-fl-muted-2 block font-mono text-xs"
                >
                  {t('provider')}
                </label>
                <select
                  id="ai-provider"
                  value={draft.provider}
                  onChange={(e) =>
                    updateDraft({
                      provider: e.target.value as LlmProvider | '',
                    })
                  }
                  className={inputClass}
                  required
                >
                  <option value="">{t('selectProvider')}</option>
                  {LLM_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider === 'custom'
                        ? t('customProvider')
                        : provider === 'ollama'
                          ? 'Ollama'
                          : provider === 'openai'
                            ? 'OpenAI'
                            : provider === 'anthropic'
                              ? 'Anthropic'
                              : 'DeepSeek'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="ai-model"
                  className="text-fl-muted-2 block font-mono text-xs"
                >
                  {t('model')}
                </label>
                <input
                  id="ai-model"
                  maxLength={200}
                  value={draft.model}
                  onChange={(e) => updateDraft({ model: e.target.value })}
                  className={inputClass}
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="ai-base-url"
                className="text-fl-muted-2 block font-mono text-xs"
              >
                {t('baseUrl')}
              </label>
              <input
                id="ai-base-url"
                type="url"
                maxLength={2048}
                value={draft.baseUrl}
                onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                className={inputClass}
                autoComplete="off"
                aria-describedby="ai-url-hint"
                required={draft.provider === 'custom'}
              />
              <p
                id="ai-url-hint"
                className="text-fl-muted-3 font-mono text-xs leading-relaxed"
              >
                {t('urlHint')}
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="ai-api-key"
                className="text-fl-muted-2 block font-mono text-xs"
              >
                {t('apiKey')}
              </label>
              <input
                id="ai-api-key"
                type="password"
                value={draft.apiKey}
                onChange={(e) => updateDraft({ apiKey: e.target.value })}
                className={inputClass}
                autoComplete="new-password"
                spellCheck={false}
                aria-describedby="ai-key-hint"
              />
              <p
                id="ai-key-hint"
                className="text-fl-muted-3 font-mono text-xs leading-relaxed"
              >
                {t(keyReusable ? 'keySaved' : 'keyHint')}
              </p>
            </div>
            {draft.provider === 'anthropic' && (
              <div className="space-y-2">
                <label
                  htmlFor="ai-max-tokens"
                  className="text-fl-muted-2 block font-mono text-xs"
                >
                  {t('maxTokens')}
                </label>
                <input
                  id="ai-max-tokens"
                  type="number"
                  min={1}
                  max={131072}
                  step={1}
                  value={draft.maxTokens}
                  onChange={(e) => updateDraft({ maxTokens: e.target.value })}
                  className={inputClass}
                  aria-describedby="ai-tokens-hint"
                />
                <p
                  id="ai-tokens-hint"
                  className="text-fl-muted-3 font-mono text-xs"
                >
                  {t('maxTokensHint')}
                </p>
              </div>
            )}
            <p className="text-fl-muted-3 font-mono text-xs">{t('testHint')}</p>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={buttonClass}>
                {busy === 'save' ? tCommon('saving') : tCommon('save')}
              </button>
              <button
                type="button"
                onClick={() => void submit('test')}
                className={buttonClass}
              >
                {busy === 'test' ? t('testing') : t('test')}
              </button>
            </div>
          </fieldset>
          {busy && (
            <p role="status" className="text-fl-muted-2 mt-3 font-mono text-sm">
              {busy === 'save' ? tCommon('saving') : t('testing')}
            </p>
          )}
          {message && (
            <output
              role={message.kind === 'error' ? 'alert' : undefined}
              className={`mt-3 block font-mono text-sm ${message.kind === 'error' ? 'text-fl-error' : 'text-fl-fg'}`}
            >
              {t(message.key)}
            </output>
          )}
        </form>
      )}
    </>
  )
}
