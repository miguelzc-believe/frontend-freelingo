import type { ReactNode } from 'react'

export default function LegalLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <div className="bg-fl-bg min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  )
}
