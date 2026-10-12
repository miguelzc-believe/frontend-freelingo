import { NativeHelpSection } from './NativeHelpSection'
import type { NativeHelpOccurrence, NativeHelpTrap } from './types'

export function NativeHelpTraps({
  title,
  items,
}: Readonly<{
  title: string
  items: readonly NativeHelpOccurrence<NativeHelpTrap>[]
}>) {
  if (!items.length) return null
  return (
    <NativeHelpSection title={title}>
      {items.map(({ value: trap, key }) => (
        <div key={key} className="space-y-0.5">
          <p className="text-fl-muted-2 text-sm">{trap.mistake}</p>
          <p className="text-fl-muted-1 text-sm leading-relaxed">{trap.fix}</p>
        </div>
      ))}
    </NativeHelpSection>
  )
}
