import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthStore } from '@/store/auth'
import { useLlmStatus } from '@/hooks/useLlmStatus'
import Link from '@/components/ui/app-link'
import { fetchVoiceStatus } from '@/lib/voice-settings'

export function AiConfigurationBanner() {
  const t = useTranslations('settings.ai')
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  const userRole = user?.role
  const { status } = useLlmStatus(Boolean(user))
  const [missingVoice, setMissingVoice] = useState<string[]>([])
  useEffect(() => {
    if (!userId) return
    let active = true
    let request = 0
    async function reload() {
      const current = ++request
      const results = await Promise.allSettled([
        fetchVoiceStatus('tts'),
        fetchVoiceStatus('stt'),
      ])
      if (!active || current !== request) return
      setMissingVoice(
        results.flatMap((result, index) =>
          result.status === 'fulfilled' && !result.value.configured
            ? [index === 0 ? 'bannerMissingTts' : 'bannerMissingStt']
            : []
        )
      )
    }
    void reload()
    window.addEventListener('freelingo:voice-settings-saved', reload)
    window.addEventListener('focus', reload)
    return () => {
      active = false
      window.removeEventListener('freelingo:voice-settings-saved', reload)
      window.removeEventListener('focus', reload)
    }
  }, [userId])
  if (
    !user ||
    ((!status || status.configured) && missingVoice.length === 0)
  )
    return null
  return (
    <div
      role="status"
      className="border-fl-border bg-fl-surface flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 font-mono text-xs"
    >
        {status?.configured === false && (
          <span className="text-fl-fg">{t('missing')}</span>
        )}
        {missingVoice.map((key) => (
          <span className="text-fl-fg" key={key}>
            {t(`voice.${key}`)}
          </span>
        ))}
        <span className="text-fl-muted-2">
          {t(
            status?.configured === false
              ? userRole === 'admin'
                ? 'bannerAdmin'
                : 'readonly'
              : 'voice.globalHint'
          )}
      </span>
      <Link
        href="/settings#ai"
        className="text-fl-fg underline underline-offset-2"
      >
        {t('openSettings')}
      </Link>
    </div>
  )
}
