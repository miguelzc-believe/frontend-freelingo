export function PracticeEmptyState({
  label,
  generateLabel,
  onGenerate,
}: Readonly<{
  label: string
  generateLabel: string
  onGenerate: () => void
}>) {
  return (
    <div className="border-fl-border bg-fl-surface flex flex-col items-center gap-5 border p-8 text-center">
      <p className="text-fl-muted-2 font-mono text-xs tracking-wide">{label}</p>
      <button
        onClick={onGenerate}
        className="border-fl-border bg-fl-surface text-fl-fg hover:bg-fl-surface-2 border px-8 py-3 font-mono text-sm tracking-widest uppercase transition-colors"
      >
        {generateLabel}
      </button>
    </div>
  )
}
