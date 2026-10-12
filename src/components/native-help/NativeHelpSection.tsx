import type { ReactNode } from 'react'

export function NativeHelpSection({
  title,
  children,
  className = 'border-fl-border space-y-2 border-t pt-3',
}: Readonly<{
  title: string
  children: ReactNode
  className?: string
}>) {
  return (
    <div className={className}>
      <p className="text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}
