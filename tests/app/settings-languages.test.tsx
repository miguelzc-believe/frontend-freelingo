import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchLanguages: vi.fn(),
  switchLanguage: vi.fn(),
  addLanguage: vi.fn(),
  removeLanguage: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  state: {
    userLanguages: [] as Array<Record<string, unknown>>,
    availableLanguageCodes: [] as string[],
  },
}))

vi.mock('use-intl', () => ({
  useLocale: () => 'en-GB',
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock('@/store/language', () => ({
  useLanguageStore: (
    selector: (state: typeof mocks.state & Record<string, unknown>) => unknown
  ) => selector({ ...mocks.state, ...mocks }),
}))

import MyLanguagesPage from '@/app/(app)/settings/languages/page'

const active = {
  target_language: 'en-GB',
  is_active: true,
  plan: { cefr_level: 'B2', completion_pct: 40 },
  progress: null,
}
const inactive = {
  target_language: 'es-ES',
  is_active: false,
  plan: { cefr_level: 'A2', completion_pct: 10 },
  progress: null,
}

function setup(
  languages = [active, inactive],
  enabled = ['en-GB', 'es-ES', 'fr-FR']
) {
  mocks.state.userLanguages = languages
  mocks.state.availableLanguageCodes = enabled
  mocks.fetchLanguages.mockResolvedValue(undefined)
  return render(<MyLanguagesPage />)
}

describe('language settings page', () => {
  beforeEach(() => {
    Object.values(mocks)
      .filter((value) => typeof value === 'function')
      .forEach((mock) => (mock as ReturnType<typeof vi.fn>).mockReset())
    mocks.state.userLanguages = []
    mocks.state.availableLanguageCodes = []
  })

  it('loads language cards with plan details and active actions', async () => {
    setup()
    expect(await screen.findByText('activeLanguage')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'viewDetails →' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'switchTo' })).toHaveLength(1)
    expect(
      screen.getAllByRole('button', { name: 'removeLanguage' })
    ).toHaveLength(1)
    expect(mocks.fetchLanguages).toHaveBeenCalledOnce()
  })

  it('shows only unused operator-enabled languages in the add selector', async () => {
    setup()
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: '+ addLanguage' }))
    expect(
      screen.getByRole('button', { name: 'fr-FRfr-FR' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'en-GBen-GB' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'es-ESes-ES' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'en-USen-US' })
    ).not.toBeInTheDocument()
  })

  it('adds a selected language, closes and resets the modal, then routes to assessment', async () => {
    mocks.addLanguage.mockResolvedValueOnce(true)
    setup([active], ['en-GB', 'fr-FR'])
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: '+ addLanguage' }))
    fireEvent.click(screen.getByRole('button', { name: 'fr-FRfr-FR' }))
    fireEvent.click(screen.getByRole('button', { name: 'addLanguage' }))
    await waitFor(() => expect(mocks.addLanguage).toHaveBeenCalledWith('fr-FR'))
    expect(mocks.push).toHaveBeenCalledWith('/assessment')
    expect(screen.queryByText('selectLanguage')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ addLanguage' }))
    expect(screen.getByRole('button', { name: 'addLanguage' })).toBeDisabled()
  })

  it('keeps the add modal open and does not navigate when adding fails', async () => {
    mocks.addLanguage.mockResolvedValueOnce(false)
    setup([active], ['en-GB', 'fr-FR'])
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: '+ addLanguage' }))
    fireEvent.click(screen.getByRole('button', { name: 'fr-FRfr-FR' }))
    fireEvent.click(screen.getByRole('button', { name: 'addLanguage' }))
    await waitFor(() => expect(mocks.addLanguage).toHaveBeenCalledWith('fr-FR'))
    expect(screen.getByText('selectLanguage')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('switches an inactive language and refreshes after success', async () => {
    mocks.switchLanguage.mockResolvedValueOnce(true)
    setup()
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: 'switchTo' }))
    await waitFor(() =>
      expect(mocks.switchLanguage).toHaveBeenCalledWith('es-ES')
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(await screen.findByText('switched')).toBeInTheDocument()
  })

  it('does not switch or remove the active card, and canceling removal makes no call', async () => {
    setup()
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: 'viewDetails →' }))
    expect(mocks.push).toHaveBeenCalledWith('/plan')
    fireEvent.click(screen.getByRole('button', { name: 'removeLanguage' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(mocks.removeLanguage).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('closes the confirmed delete dialog and shows an error toast on failure', async () => {
    mocks.removeLanguage.mockResolvedValueOnce(false)
    setup()
    await screen.findByText('activeLanguage')
    fireEvent.click(screen.getByRole('button', { name: 'removeLanguage' }))
    fireEvent.click(screen.getByRole('button', { name: 'removeConfirmButton' }))
    await waitFor(() =>
      expect(mocks.removeLanguage).toHaveBeenCalledWith('es-ES')
    )
    expect(await screen.findByText('deleteError')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('renders the empty state when loading completes without languages', async () => {
    setup([], ['fr-FR'])
    expect(await screen.findByText('noLanguages')).toBeInTheDocument()
    expect(mocks.fetchLanguages).toHaveBeenCalledOnce()
  })
})
