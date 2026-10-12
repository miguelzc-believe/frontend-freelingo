import type { ReactNode } from 'react'

const WRAPPER_CLASSES = {
  panel: 'border-fl-border bg-fl-surface border',
  compact: 'border-fl-border border-b px-5 py-3',
}

/** Controlled presentation only: each screen owns its open and request state. */
export function NativeHelpDisclosure({
  title,
  open,
  onToggle,
  children,
  variant = 'panel',
}: Readonly<{
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  variant?: keyof typeof WRAPPER_CLASSES
}>) {
  return (
    <div className={WRAPPER_CLASSES[variant]}>
      <button
        type="button"
        onClick={onToggle}
        className={
          variant === 'panel'
            ? 'border-fl-border text-fl-label text-fl-muted-2 hover:text-fl-fg flex w-full items-center justify-between border-b px-6 py-4 font-mono tracking-widest uppercase transition-colors'
            : 'text-fl-label text-fl-muted-3 hover:text-fl-fg flex w-full items-center justify-between font-mono tracking-widest uppercase transition-colors'
        }
        aria-expanded={open}
      >
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && children}
    </div>
  )
}
