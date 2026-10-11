import type { ReactNode } from 'react'
import { Brand } from '@/components/auth/Brand'

type AuthShellProps = {
  title: string
  tagline: string
  headerAside?: ReactNode
  children: ReactNode
}

export function AuthShell({
  title,
  tagline,
  headerAside,
  children,
}: AuthShellProps) {
  return (
    <div className="bg-fl-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Brand variant="auth" tagline={tagline} />

        <div className="border-fl-border bg-fl-surface border p-8">
          <div className="border-fl-border mb-6 flex items-center gap-2 border-b pb-4">
            <span className="text-fl-label text-fl-muted-2">●</span>
            <span className="text-fl-muted-2 font-mono text-xs tracking-widest uppercase">
              {title}
            </span>
            {headerAside}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
