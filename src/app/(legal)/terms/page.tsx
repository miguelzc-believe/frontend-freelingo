import { useTranslations } from 'use-intl'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { LegalSection } from '@/components/legal/LegalSection'
import { useLegalNavigation } from '@/components/legal/useLegalNavigation'

export default function TermsPage() {
  const t = useTranslations('legal.terms')
  const navigation = useLegalNavigation(t, '/privacy')
  const s2Items = [t('s2i1'), t('s2i2'), t('s2i3'), t('s2i4')]

  return (
    <LegalDocument
      title={t('pageTitle')}
      updated={t('updated')}
      documentLabel={t('linkPrivacy')}
      {...navigation}
    >
      <LegalSection title={t('s1Title')} body={t('s1Body')} />
      <LegalSection title={t('s2Title')} body={t('s2Intro')} items={s2Items} />

      {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((number) => (
        <LegalSection
          key={t(`s${number}Title`)}
          title={t(`s${number}Title`)}
          body={t(`s${number}Body`)}
        />
      ))}

      <p className="text-fl-muted-2 font-mono text-xs tracking-wide">
        {t('linkContact')}
      </p>
    </LegalDocument>
  )
}
