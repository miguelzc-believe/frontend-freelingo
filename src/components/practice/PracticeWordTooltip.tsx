import {
  WordTooltip,
  type SaveState,
  type TooltipPos,
} from '@/components/ui/WordTooltip'

export function PracticeWordTooltip({
  selectedWord,
  tooltipPos,
  saveState,
  onSave,
  onDismiss,
  tCommon,
}: Readonly<{
  selectedWord: string | null
  tooltipPos: TooltipPos
  saveState: SaveState
  onSave: () => void
  onDismiss: () => void
  tCommon: (key: string) => string
}>) {
  if (!selectedWord) return null

  return (
    <WordTooltip
      word={selectedWord}
      pos={tooltipPos}
      saveState={saveState}
      onSave={() => onSave()}
      onDismiss={onDismiss}
      labels={{
        saveWord: tCommon('saveWord'),
        wordSaved: tCommon('wordSaved'),
        wordAlreadySaved: tCommon('wordAlreadySaved'),
        wordSaveError: tCommon('wordSaveError'),
      }}
    />
  )
}
