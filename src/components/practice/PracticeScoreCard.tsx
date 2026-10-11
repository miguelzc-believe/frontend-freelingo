export function PracticeScoreCard({
  score,
  questionCount,
  xpEarned,
  isReplay,
  resultsLabel,
  replayNoXpLabel,
}: Readonly<{
  score: number
  questionCount: number
  xpEarned: number
  isReplay: boolean
  resultsLabel: string
  replayNoXpLabel: string
}>) {
  return (
    <div className="border-fl-border bg-fl-surface border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
            {resultsLabel}
          </p>
          <p className="text-fl-fg mt-1 font-mono text-2xl font-bold">
            {score}/{questionCount}
          </p>
        </div>
        <div className="text-right">
          <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
            XP
          </p>
          {isReplay ? (
            <p className="text-fl-label text-fl-muted-3 mt-1 font-mono">
              {replayNoXpLabel}
            </p>
          ) : (
            <p className="text-fl-accent mt-1 font-mono text-xl font-bold">
              +{xpEarned}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
