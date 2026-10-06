import { useTranslations } from 'use-intl'
import { useAuthStore } from '@/store/auth'
import { useLlmStatus } from '@/hooks/useLlmStatus'
import Link from '@/components/ui/app-link'

export function AiConfigurationBanner() {
  const t = useTranslations('settings.ai')
  const user = useAuthStore((s) => s.user)
  const { status } = useLlmStatus(Boolean(user))
  if (!user || !status || status.configured) return null
  return (
    <div
      role="status"
      className="border-fl-border bg-fl-surface flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 font-mono text-xs"
    >
      <span className="text-fl-fg">{t('missing')}</span>
      <span className="text-fl-muted-2">
        {t(user.role === 'admin' ? 'bannerAdmin' : 'readonly')}
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
