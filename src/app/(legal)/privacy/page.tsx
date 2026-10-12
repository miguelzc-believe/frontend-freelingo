import { useTranslations } from 'use-intl'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { LegalSection } from '@/components/legal/LegalSection'
import { useLegalNavigation } from '@/components/legal/useLegalNavigation'

export default function PrivacyPage() {
  const t = useTranslations('legal.privacy')
  const navigation = useLegalNavigation(t, '/terms')
  const s2Items = [
    t('s2i1'),
    t('s2i2'),
    t('s2i3'),
    t('s2i4'),
    t('s2i5'),
    t('s2i6'),
    t('s2i7'),
    t('s2i8'),
    t('s2i9'),
    t('s2i10'),
  ]
  const s3Items = [
    t('s3i1'),
    t('s3i2'),
    t('s3i3'),
    t('s3i4'),
    t('s3i5'),
    t('s3i6'),
  ]

  return (
    <LegalDocument
      title={t('pageTitle')}
      updated={t('updated')}
      documentLabel={t('linkTerms')}
      {...navigation}
    >
      <LegalSection title={t('s1Title')} body={t('s1Body')} />
      <LegalSection title={t('s2Title')} body={t('s2Intro')} items={s2Items} />
      <LegalSection
        title={t('s3Title')}
        body={t('s3Intro')}
        items={s3Items}
        footer={t('s3Footer')}
      />

      {[4, 5, 6, 7, 8, 9].map((number) => (
        <LegalSection
          key={t(`s${number}Title`)}
          title={t(`s${number}Title`)}
          body={t(`s${number}Body`)}
        />
      ))}
    </LegalDocument>
  )
}
