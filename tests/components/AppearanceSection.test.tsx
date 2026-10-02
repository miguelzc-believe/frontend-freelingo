import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSetTheme, themeState } = vi.hoisted(() => ({
  mockSetTheme: vi.fn(),
  themeState: { theme: 'system' as 'system' | 'dark' | 'light' },
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/store/theme', () => ({
  useThemeStore: (
    selector: (
      state: typeof themeState & { setTheme: typeof mockSetTheme }
    ) => unknown
  ) => selector({ ...themeState, setTheme: mockSetTheme }),
}))

import { AppearanceSection } from '@/components/settings/AppearanceSection'

const selectedStyles = ['border-fl-border-2', 'text-fl-fg', 'bg-fl-surface-2']
const unselectedStyles = ['border-fl-border', 'text-fl-muted-2']
const themes = [
  { value: 'system', label: 'themeSystem', active: 'systemActive' },
  { value: 'dark', label: 'themeDark', active: 'darkActive' },
  { value: 'light', label: 'themeLight', active: 'lightActive' },
] as const

describe('AppearanceSection', () => {
  beforeEach(() => {
    themeState.theme = 'system'
    mockSetTheme.mockClear()
  })

  it('renders the translated default title and supports a custom title', () => {
    const { rerender } = render(<AppearanceSection />)
    expect(screen.getByText('sectionAppearance')).toBeInTheDocument()

    rerender(<AppearanceSection title="Display" />)
    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.queryByText('sectionAppearance')).not.toBeInTheDocument()
  })

  it.each(themes)(
    'shows $active and styles $value as selected',
    ({ value, label, active }) => {
      themeState.theme = value
      render(<AppearanceSection />)

      expect(screen.getByText(active)).toBeInTheDocument()
      const buttons = screen.getAllByRole('button')
      const selected = screen.getByRole('button', { name: label })
      expect(selected.className).toContain(selectedStyles.join(' '))
      for (const button of buttons) {
        if (button !== selected) {
          for (const style of unselectedStyles)
            expect(button.className).toContain(style)
        }
      }
    }
  )

  it.each(themes)(
    'calls setTheme with $value when its button is selected',
    ({ value, label }) => {
      render(<AppearanceSection />)

      fireEvent.click(screen.getByRole('button', { name: label }))

      expect(mockSetTheme).toHaveBeenCalledExactlyOnceWith(value)
    }
  )
})
