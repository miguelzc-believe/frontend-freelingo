import { useTranslations } from 'use-intl'
import { useThemeStore } from '@/store/theme'

function activeThemeKey(theme: string) {
  if (theme === 'dark') return 'darkActive'
  if (theme === 'light') return 'lightActive'
  return 'systemActive'
}

function themeOptionKey(theme: string) {
  if (theme === 'system') return 'themeSystem'
  if (theme === 'dark') return 'themeDark'
  return 'themeLight'
}

export function AppearanceSection({ title }: { title?: string } = {}) {
  const t = useTranslations('settings')
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div className="border-fl-border bg-fl-surface border p-6">
      <div className="border-fl-border mb-5 flex items-center gap-2 border-b pb-4">
        <span className="text-fl-label text-fl-muted-2">●</span>
        <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
          {title ?? t('sectionAppearance')}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-fl-fg font-mono text-xs tracking-wide">
            {t('theme')}
          </p>
          <p className="text-fl-label text-fl-muted-2 mt-0.5 font-mono">
            {t(activeThemeKey(theme))}
          </p>
        </div>
        <div className="flex gap-1">
          {(['system', 'dark', 'light'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setTheme(opt)}
              className={`border px-3 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${
                theme === opt
                  ? 'border-fl-border-2 text-fl-fg bg-fl-surface-2'
                  : 'border-fl-border text-fl-muted-2 hover:border-fl-border-2 hover:text-fl-fg'
              }`}
            >
              {t(themeOptionKey(opt))}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
