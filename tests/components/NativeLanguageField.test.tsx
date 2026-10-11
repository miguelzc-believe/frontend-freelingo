import { fireEvent, render, screen } from '@testing-library/react'
import { NativeLanguageField } from '@/components/NativeLanguageField'

const languageName = (code: string) => code

it('preserves native choices, translated sorting and controlled selection', () => {
  const onChange = vi.fn()
  const view = render(
    <NativeLanguageField
      label="Native language"
      value="es"
      onChange={onChange}
      languageName={languageName}
    />
  )
  const select = screen.getByRole('combobox')
  expect(select).toHaveValue('es')
  expect(
    screen.getAllByRole('option').map((option) => option.getAttribute('value'))
  ).toEqual([
    'da',
    'de',
    'en',
    'es',
    'fi',
    'fr',
    'hr',
    'it',
    'nl',
    'pl',
    'pt',
    'ro',
    'ru',
    'sv',
    'tr',
  ])
  fireEvent.change(select, { target: { value: 'fr' } })
  expect(onChange).toHaveBeenCalledWith('fr')
  view.rerender(
    <NativeLanguageField
      label="Native language"
      value="fr"
      onChange={onChange}
      languageName={languageName}
    />
  )
  expect(select).toHaveValue('fr')
  expect(select).toHaveClass('appearance-none', 'bg-fl-bg', 'font-mono')
})

it('sorts labels rather than codes without changing the catalog', () => {
  render(
    <NativeLanguageField
      label="Native language"
      value="en"
      onChange={vi.fn()}
      languageName={(code) => (code === 'en' ? 'AAA English' : code)}
    />
  )
  expect(screen.getAllByRole('option')[0]).toHaveValue('en')
  expect(screen.getAllByRole('option')).toHaveLength(15)
})
