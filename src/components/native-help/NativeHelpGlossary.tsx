import { TargetLanguageText } from '@/components/TargetLanguageText'
import { NativeHelpSection } from './NativeHelpSection'
import type { NativeHelpGlossaryItem, NativeHelpOccurrence } from './types'

export function NativeHelpGlossary({
  title,
  items,
  languageCode,
}: Readonly<{
  title: string
  items: readonly NativeHelpOccurrence<NativeHelpGlossaryItem>[]
  languageCode: string
}>) {
  if (!items.length) return null
  return (
    <NativeHelpSection title={title}>
      {items.map(({ value: item, key }) => (
        <div key={key}>
          <TargetLanguageText
            languageCode={languageCode}
            className="text-fl-muted-1 text-sm font-bold"
          >
            {item.term}
          </TargetLanguageText>
          <p className="text-fl-muted-2 text-sm">{item.meaning}</p>
          {item.note && (
            <p className="text-fl-muted-1 text-sm leading-relaxed">
              {item.note}
            </p>
          )}
        </div>
      ))}
    </NativeHelpSection>
  )
}
