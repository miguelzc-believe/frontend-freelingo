type Translate = (key: string) => string

export function getLegalDocumentHref(
  page: '/terms' | '/privacy',
  from: string | null,
  invite: string | null
): string {
  if (from === 'settings' || from === 'landing') return `${page}?from=${from}`
  if (from !== 'register') return page
  const inviteQuery = invite ? `&invite=${encodeURIComponent(invite)}` : ''
  return `${page}?from=register${inviteQuery}`
}

export function getLegalBackHref(
  isFromSettings: boolean,
  isFromRegister: boolean,
  invite: string | null,
  allowRegistration: boolean
): string {
  if (isFromSettings) return '/settings'
  if (!isFromRegister) return '/'
  if (invite) return `/register?invite=${encodeURIComponent(invite)}`
  return allowRegistration ? '/register' : '/login'
}

export function getLegalBackLabel(
  isFromSettings: boolean,
  isFromRegister: boolean,
  invite: string | null,
  allowRegistration: boolean,
  t: Translate,
  tRegister: Translate,
  tCommon: Translate
): string {
  if (isFromSettings) return t('linkBackSettings')
  if (!isFromRegister) return tCommon('back')
  return allowRegistration || invite ? t('linkBack') : tRegister('login')
}
