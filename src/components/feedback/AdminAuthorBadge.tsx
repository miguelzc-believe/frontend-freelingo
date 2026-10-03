import { useTranslations } from 'use-intl'

export function AdminAuthorBadge({ role }: { readonly role: string }) {
  const t = useTranslations('admin')
  if (role !== 'admin') return null

  return (
    <span className="border-fl-accent/40 text-fl-accent text-fl-hint inline-flex border px-1.5 py-px font-mono leading-none font-bold tracking-widest uppercase">
      {t('roleAdmin')}
    </span>
  )
}
