import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useThemeStore } from '@/store/theme'

function mockSystemPreference(light: boolean) {
  const target = new EventTarget()
  const addEventListener = vi.fn(target.addEventListener.bind(target))
  const removeEventListener = vi.fn(target.removeEventListener.bind(target))
  const media = Object.assign(target, {
    matches: light,
    media: '(prefers-color-scheme: light)',
    onchange: null,
    addEventListener,
    removeEventListener,
  })
  const matchMedia = vi.fn(() => media)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    media,
    matchMedia,
    change(matches: boolean) {
      media.matches = matches
      act(() => {
        target.dispatchEvent(Object.assign(new Event('change'), { matches }))
      })
    },
  }
}

function expectDark() {
  expect(document.documentElement).not.toHaveAttribute('data-theme')
  expect(document.documentElement.dataset.theme).toBeUndefined()
}

beforeEach(() => {
  useThemeStore.setState({ theme: 'system' })
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useThemeStore.setState({ theme: 'system' })
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeProvider', () => {
  it.each([true, false])(
    'follows initial system light=%s and changes without persisting an OS choice',
    (light) => {
      const system = mockSystemPreference(light)
      render(
        <ThemeProvider>
          <span>Child content</span>
        </ThemeProvider>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
      expect(system.matchMedia).toHaveBeenCalledExactlyOnceWith(
        '(prefers-color-scheme: light)'
      )
      if (light)
        expect(document.documentElement).toHaveAttribute('data-theme', 'light')
      else expectDark()
      expect(system.media.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )

      system.change(!light)
      if (light) expectDark()
      else expect(document.documentElement.dataset.theme).toBe('light')
      expect(useThemeStore.getState().theme).toBe('system')
      expect(localStorage.getItem('fl-theme')).toBeNull()
    }
  )

  it('removes the system listener when switching away and preserves explicit preference persistence', () => {
    const system = mockSystemPreference(false)
    const view = render(<ThemeProvider>Content</ThemeProvider>)
    const handler = system.media.addEventListener.mock.calls[0]?.[1]
    expect(handler).toBeTypeOf('function')

    act(() => useThemeStore.getState().setTheme('light'))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(system.media.removeEventListener).toHaveBeenCalledExactlyOnceWith(
      'change',
      handler
    )
    system.change(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(JSON.parse(localStorage.getItem('fl-theme')!).state.theme).toBe(
      'light'
    )

    act(() => useThemeStore.getState().setTheme('dark'))
    expectDark()
    expect(JSON.parse(localStorage.getItem('fl-theme')!).state.theme).toBe(
      'dark'
    )
    expect(system.matchMedia).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(system.media.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('removes the system listener on unmount and ignores subsequent OS changes', () => {
    const system = mockSystemPreference(true)
    const view = render(<ThemeProvider>Content</ThemeProvider>)
    const handler = system.media.addEventListener.mock.calls[0]?.[1]
    expect(handler).toBeTypeOf('function')
    view.unmount()

    expect(system.media.removeEventListener).toHaveBeenCalledExactlyOnceWith(
      'change',
      handler
    )
    system.change(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('fl-theme')).toBeNull()
  })
})
