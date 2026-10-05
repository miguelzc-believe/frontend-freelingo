import { useEffect } from 'react'
import { useThemeStore } from '@/store/theme'

function applyTheme(theme: 'dark' | 'light') {
  const html = document.documentElement
  if (theme === 'light') {
    html.dataset.theme = 'light'
  } else {
    delete html.dataset.theme
  }
}

export function ThemeProvider({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    if (theme !== 'system') {
      applyTheme(theme)
      return
    }

    // System: follow OS preference
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      applyTheme(e.matches ? 'light' : 'dark')
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return <>{children}</>
}
