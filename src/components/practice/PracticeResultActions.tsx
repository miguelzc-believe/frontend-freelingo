export function PracticeResultActions({
  onNext,
  onHistory,
  nextLabel,
  historyLabel,
}: Readonly<{
  onNext: () => void
  onHistory: (page: number) => void
  nextLabel: string
  historyLabel: string
}>) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        onClick={onNext}
        className="border-fl-border bg-fl-surface text-fl-fg hover:bg-fl-surface-2 flex-1 border py-3 font-mono text-sm tracking-widest uppercase transition-colors"
      >
        {nextLabel}
      </button>
      <button
        onClick={() => onHistory(0)}
        className="border-fl-border bg-fl-surface text-fl-muted-2 hover:text-fl-fg hover:bg-fl-surface-2 border px-4 py-3 font-mono text-xs tracking-widest uppercase transition-colors"
      >
        {historyLabel}
      </button>
    </div>
  )
}
