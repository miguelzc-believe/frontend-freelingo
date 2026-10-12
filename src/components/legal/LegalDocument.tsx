import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import Link from '@/components/ui/app-link'
import { Brand } from '@/components/auth/Brand'

type LegalDocumentProps = {
  title: string
  updated: string
  documentHref: string
  documentLabel: string
  backHref: string
  backLabel: string
  children: ReactNode
}

export function LegalDocument({
  title,
  updated,
  documentHref,
  documentLabel,
  backHref,
  backLabel,
  children,
}: Readonly<LegalDocumentProps>) {
  const tCommon = useTranslations('common')

  return (
    <div>
      <Brand variant="legal" tagline={tCommon('tagline')} />

      <div className="border-fl-border bg-fl-surface space-y-8 border p-8">
        <div className="border-fl-border flex items-center gap-2 border-b pb-4">
          <span className="text-fl-label text-fl-muted-2">●</span>
          <span className="text-fl-muted-2 font-mono text-xs tracking-widest uppercase">
            {title}
          </span>
        </div>

        <p className="text-fl-hint text-fl-muted-2 font-mono tracking-wide">
          {updated}
        </p>

        {children}

        <div className="border-fl-border flex gap-6 border-t pt-4">
          <Link
            href={documentHref}
            className="text-fl-muted-2 hover:text-fl-fg font-mono text-xs tracking-widest uppercase transition-colors"
          >
            {documentLabel}
          </Link>
          <Link
            href={backHref}
            className="text-fl-muted-2 hover:text-fl-fg font-mono text-xs tracking-widest uppercase transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
