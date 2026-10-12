import { useEffect } from 'react'
import { useTranslations } from 'use-intl'
import { useSearchParams } from '@/lib/navigation'
import { useConfigStore } from '@/store/config'
import {
  getLegalBackHref,
  getLegalBackLabel,
  getLegalDocumentHref,
} from '@/lib/legal-navigation'

export function useLegalNavigation(
  t: (key: string) => string,
  otherPage: '/terms' | '/privacy'
) {
  const tCommon = useTranslations('common')
  const tRegister = useTranslations('auth.register')
  const searchParams = useSearchParams()
  const allowRegistration = useConfigStore((s) => s.allowRegistration)
  const loadConfig = useConfigStore((s) => s.load)
  const invite = searchParams.get('invite')
  const from = searchParams.get('from')
  const isFromSettings = from === 'settings'
  const isFromRegister = from === 'register'

  useEffect(() => {
    if (isFromRegister) void loadConfig()
  }, [isFromRegister, loadConfig])

  return {
    backHref: getLegalBackHref(
      isFromSettings,
      isFromRegister,
      invite,
      allowRegistration
    ),
    backLabel: getLegalBackLabel(
      isFromSettings,
      isFromRegister,
      invite,
      allowRegistration,
      t,
      tRegister,
      tCommon
    ),
    documentHref: getLegalDocumentHref(otherPage, from, invite),
  }
}
