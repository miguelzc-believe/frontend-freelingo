import { TargetLanguageText } from '@/components/TargetLanguageText'
import type { Question } from '@/types/api'

interface CorrectAnswer {
  index: number
  correct: string
}

function getOptionReviewClass(
  key: string,
  correctKey: string | undefined,
  userAnswer: string | undefined,
  isCorrect: boolean
): string {
  if (key === correctKey) return 'text-fl-success font-bold'
  if (key === userAnswer && !isCorrect) return 'text-fl-error-fg line-through'
  return 'text-fl-muted-1'
}

export function PracticeQuestionReview({
  questions,
  correctAnswers,
  answers,
  languageCode,
  reviewLabel,
}: Readonly<{
  questions: readonly Question[]
  correctAnswers: readonly CorrectAnswer[]
  answers: Readonly<Record<string, string>>
  languageCode: string
  reviewLabel: string
}>) {
  return (
    <div className="space-y-3">
      <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
        {reviewLabel}
      </p>
      {questions.map((q) => {
        const correctKey = correctAnswers.find(
          (c) => c.index === q.index
        )?.correct
        const userAnswer = answers[String(q.index)]
        const isCorrect = userAnswer === correctKey
        return (
          <div
            key={q.index}
            className={`border p-4 ${
              isCorrect
                ? 'border-fl-success/50 bg-fl-success/5'
                : 'border-fl-error-fg/50 bg-fl-error-fg/5'
            }`}
          >
            <TargetLanguageText
              as="p"
              languageCode={languageCode}
              className="text-fl-fg mb-3"
            >
              {q.index + 1}. {q.question}
            </TargetLanguageText>
            <div className="space-y-1">
              {Object.entries(q.options).map(([k, v]) => (
                <div
                  key={k}
                  className={`px-3 py-1.5 ${getOptionReviewClass(k, correctKey, userAnswer, isCorrect)}`}
                >
                  <span className="text-fl-label font-mono font-bold">
                    {k}.
                  </span>{' '}
                  <TargetLanguageText languageCode={languageCode}>
                    {v}
                  </TargetLanguageText>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
