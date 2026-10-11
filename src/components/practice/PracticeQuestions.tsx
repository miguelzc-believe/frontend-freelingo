import { TargetLanguageText } from '@/components/TargetLanguageText'
import type { Question } from '@/types/api'

// The modalities intentionally retain their existing hover and selected styles.
const OPTION_CLASSES = {
  reading: {
    selected: 'border-fl-accent text-fl-fg bg-fl-surface-2',
    unselected:
      'border-fl-border text-fl-muted-1 hover:border-fl-muted-2 hover:text-fl-fg',
  },
  listening: {
    selected: 'border-fl-accent bg-fl-surface-2 text-fl-fg',
    unselected:
      'border-fl-border text-fl-muted-1 hover:border-fl-border-2 hover:text-fl-fg hover:bg-fl-surface-2',
  },
} as const

export function PracticeQuestions({
  questions,
  answers,
  languageCode,
  level,
  modality,
  onTextSelection,
  onAnswer,
}: Readonly<{
  questions: readonly Question[]
  answers: Readonly<Record<string, string>>
  languageCode: string
  level: string
  modality: keyof typeof OPTION_CLASSES
  onTextSelection: (context: string, level: string) => void
  onAnswer: (index: number, key: string) => void
}>) {
  const optionClasses = OPTION_CLASSES[modality]

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div
          key={q.index}
          className="border-fl-border bg-fl-surface border p-4"
        >
          <TargetLanguageText
            as="p"
            languageCode={languageCode}
            onPointerUp={() => onTextSelection(q.question, level)}
            className="text-fl-fg word-selectable mb-3 cursor-text select-text"
          >
            {q.index + 1}. {q.question}
          </TargetLanguageText>
          <div className="space-y-2">
            {Object.entries(q.options).map(([k, v]) => {
              const selected = answers[String(q.index)] === k
              return (
                <button
                  key={k}
                  onClick={() => onAnswer(q.index, k)}
                  className={`w-full border px-3 py-2 text-left transition-colors ${
                    selected ? optionClasses.selected : optionClasses.unselected
                  }`}
                >
                  <span className="text-fl-label font-mono font-bold">
                    {k}.
                  </span>{' '}
                  <TargetLanguageText languageCode={languageCode}>
                    {v}
                  </TargetLanguageText>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
