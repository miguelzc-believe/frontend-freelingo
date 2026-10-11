import type { ReactNode } from 'react'
import { PageLoading } from '@/components/ui/page-loading'
import type { Question } from '@/types/api'

interface PracticeAttempt {
  id: number
  score: number
  xp_earned: number
  exercise: {
    topic: string
    level: string
    exercise_type: string
    questions: readonly Question[]
  }
}

export function PracticeHistoryContent<T extends PracticeAttempt>({
  historyLoading,
  history,
  onReplay,
  emptyLabel,
  replayLabel,
  renderText,
}: Readonly<{
  historyLoading: boolean
  history: readonly T[]
  onReplay: (item: T) => void
  emptyLabel: string
  replayLabel: string
  renderText: (item: T) => ReactNode
}>) {
  if (historyLoading && history.length === 0) {
    return <PageLoading fullScreen={false} className="block p-5" />
  }
  if (history.length === 0) {
    return (
      <div className="border-fl-border bg-fl-surface border p-6 text-center">
        <p className="text-fl-muted-3 font-mono text-xs tracking-wide">
          {emptyLabel}
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {history.map((item) => (
        <div
          key={item.id}
          className="border-fl-border bg-fl-surface border p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-fl-fg truncate font-mono text-xs font-bold tracking-wide">
                {item.exercise.topic}
              </p>
              <p className="text-fl-label text-fl-muted-3 mt-0.5 font-mono tracking-widest uppercase">
                {item.exercise.level} · {item.exercise.exercise_type}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-fl-fg font-mono text-xs font-bold">
                {item.score}/{item.exercise.questions.length}
              </p>
              <p className="text-fl-label text-fl-accent font-mono">
                +{item.xp_earned} XP
              </p>
            </div>
          </div>
          {renderText(item)}
          <button
            onClick={() => onReplay(item)}
            className="text-fl-muted-2 hover:text-fl-fg font-mono text-xs tracking-widest uppercase transition-colors"
          >
            {replayLabel}
          </button>
        </div>
      ))}
    </div>
  )
}
