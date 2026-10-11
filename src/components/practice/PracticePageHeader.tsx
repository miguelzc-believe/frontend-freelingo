export function PracticePageHeader({
  title,
  actionLabel,
  onAction,
}: Readonly<{
  title: string
  actionLabel: string
  onAction: () => void
}>) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-fl-fg font-mono text-sm font-bold tracking-widest uppercase">
        {title}
      </h1>
      <button
        onClick={onAction}
        className="text-fl-muted-2 hover:text-fl-fg font-mono text-xs tracking-widest uppercase transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  )
}
