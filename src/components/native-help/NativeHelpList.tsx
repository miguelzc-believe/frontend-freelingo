import { NativeHelpSection } from './NativeHelpSection'
import type { NativeHelpOccurrence } from './types'

export function NativeHelpList({
  title,
  items,
  className = 'space-y-2',
}: Readonly<{
  title: string
  items: readonly NativeHelpOccurrence<string>[]
  className?: string
}>) {
  if (!items.length) return null
  return (
    <NativeHelpSection title={title} className={className}>
      <ul className="space-y-1">
        {items.map(({ value, key }) => (
          <li
            key={key}
            className="text-fl-muted-1 max-w-[70ch] text-sm leading-relaxed"
          >
            <span className="text-fl-muted-3 mr-2">·</span>
            {value}
          </li>
        ))}
      </ul>
    </NativeHelpSection>
  )
}
