import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'use-intl'
import { TARGET_LANGUAGE_CATALOG } from '@/lib/target-languages'
import { useAuthStore } from '@/store/auth'
import { useConfigStore } from '@/store/config'
import { useLanguageStore } from '@/store/language'
import de from '../../messages/de.json'
import da from '../../messages/da.json'
import fi from '../../messages/fi.json'
import hr from '../../messages/hr.json'
import en from '../../messages/en.json'
import es from '../../messages/es.json'
import fr from '../../messages/fr.json'
import itMessages from '../../messages/it.json'
import nl from '../../messages/nl.json'
import pl from '../../messages/pl.json'
import pt from '../../messages/pt.json'
import ro from '../../messages/ro.json'
import ru from '../../messages/ru.json'
import sv from '../../messages/sv.json'
import tr from '../../messages/tr.json'

const { searchParams, apiFetch, routerPush } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  apiFetch: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => searchParams,
}))

vi.mock('@/lib/api', () => ({ apiFetch }))

import OnboardingPage from '@/app/(auth)/onboarding/page'

const catalogs = {
  da,
  de,
  en,
  es,
  fi,
  fr,
  hr,
  it: itMessages,
  nl,
  pl,
  pt,
  ro,
  ru,
  sv,
  tr,
}
type Locale = keyof typeof catalogs

const spanishSubtitles: Record<Locale, string> = {
  da: 'Sprog: Spansk. Hvad vil du bruge det til? Vælg alle relevante mål.',
  de: 'Sprache: Spanisch. Wofür möchtest du sie nutzen? Wähle alle zutreffenden Ziele aus.',
  en: 'Language: Spanish. What do you want to use it for? Select all that apply.',
  es: 'Idioma: español. ¿Para qué quieres utilizarlo? Selecciona todos los objetivos que correspondan.',
  fi: 'Kieli: Espanja. Mihin haluat käyttää sitä? Valitse kaikki sopivat.',
  fr: "Langue : espagnol. Dans quel but souhaitez-vous l'utiliser ? Sélectionnez tous les objectifs qui vous correspondent.",
  hr: 'Jezik: Španjolski. Za što ga želiš koristiti? Odaberi sve što vrijedi.',
  it: 'Lingua: spagnolo. Per cosa vuoi usarla? Seleziona tutti gli obiettivi che fanno al caso tuo.',
  nl: 'Taal: Spaans. Waarvoor wil je deze taal gebruiken? Selecteer alle doelen die van toepassing zijn.',
  pl: 'Język: hiszpański. Do czego chcesz go używać? Zaznacz wszystkie cele, które Ci odpowiadają.',
  pt: 'Idioma: espanhol. Para que você quer usá-lo? Selecione todos os objetivos que se aplicam.',
  ro: 'Limbă: spaniolă. Pentru ce vrei să o folosești? Selectează toate obiectivele care ți se potrivesc.',
  ru: 'Язык: испанский. Для чего ты хочешь его использовать? Выбери все подходящие цели.',
  sv: 'Språk: Spanska. Vad vill du använda det till? Välj alla som passar.',
  tr: 'Dil: İspanyolca. Bu dili ne için kullanmak istiyorsunuz? Uygun olanların hepsini seçin.',
}

const onIntlError = vi.fn()
const englishSubtitle =
  'Language: English. What do you want to use it for? Select all that apply.'

function languageResponse(
  codes = TARGET_LANGUAGE_CATALOG.map((language) => language.code)
) {
  return new Response(
    JSON.stringify({ languages: [], all_supported_languages: codes })
  )
}

function renderOnboarding(locale: Locale = 'en') {
  return render(
    <IntlProvider
      locale={locale}
      messages={catalogs[locale]}
      timeZone="UTC"
      onError={onIntlError}
    >
      <OnboardingPage />
    </IntlProvider>
  )
}

beforeEach(() => {
  for (const key of Array.from(searchParams.keys())) searchParams.delete(key)
  onIntlError.mockReset()
  apiFetch.mockReset()
  routerPush.mockReset()
  apiFetch.mockImplementation(async () => languageResponse())
  useAuthStore.setState({ ...useAuthStore.getInitialState() }, true)
  useConfigStore.setState(
    { ...useConfigStore.getInitialState(), loaded: true },
    true
  )
  useLanguageStore.setState({ ...useLanguageStore.getInitialState() }, true)
})

afterEach(() => {
  cleanup()
  expect(onIntlError).not.toHaveBeenCalled()
})

async function openGoalsStep() {
  fireEvent.click(await screen.findByRole('button', { name: /Spanish/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

function mockGoalSave(
  response: () => Promise<Response> = async () =>
    new Response(
      JSON.stringify({ target_language: 'es-ES', learning_goals: [] })
    )
) {
  apiFetch.mockImplementation((_path: string, options?: RequestInit) =>
    options?.method === 'PATCH'
      ? response()
      : Promise.resolve(languageResponse())
  )
}

describe('onboarding goals subtitle', () => {
  it('saves all selected goals, updates the user, and goes to the dashboard', async () => {
    useConfigStore.setState({ stripeEnabled: false })
    mockGoalSave(
      async () =>
        new Response(
          JSON.stringify({
            id: 12,
            username: 'learner',
            target_language: 'es-ES',
            learning_goals: ['travel', 'work'],
          })
        )
    )
    renderOnboarding()
    await openGoalsStep()
    fireEvent.click(screen.getByRole('button', { name: /Travel & Tourism/ }))
    fireEvent.click(screen.getByRole('button', { name: /Work & Professional/ }))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    )

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_language: 'es-ES',
        learning_goals: ['travel', 'work'],
      }),
    })
    expect(useAuthStore.getState().user).toMatchObject({
      target_language: 'es-ES',
      learning_goals: ['travel', 'work'],
    })
    await vi.waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith('/dashboard')
    )
    expect(
      screen.queryByText(en.onboarding.trialHeadline)
    ).not.toBeInTheDocument()
  })

  it('removes a deselected goal from the saved payload', async () => {
    useConfigStore.setState({ stripeEnabled: false })
    mockGoalSave(
      async () =>
        new Response(
          JSON.stringify({ target_language: 'es-ES', learning_goals: ['work'] })
        )
    )
    renderOnboarding()
    await openGoalsStep()
    fireEvent.click(screen.getByRole('button', { name: /Travel & Tourism/ }))
    fireEvent.click(screen.getByRole('button', { name: /Work & Professional/ }))
    fireEvent.click(screen.getByRole('button', { name: /Travel & Tourism/ }))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    )

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        body: JSON.stringify({
          target_language: 'es-ES',
          learning_goals: ['work'],
        }),
      })
    )
    expect(useAuthStore.getState().user).toMatchObject({
      target_language: 'es-ES',
      learning_goals: ['work'],
    })
    expect(routerPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows the paid trial step when Stripe is enabled', async () => {
    useConfigStore.setState({ stripeEnabled: true })
    mockGoalSave()
    renderOnboarding()
    await openGoalsStep()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText('Start with 7 days free')
    ).toBeInTheDocument()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('shows freemium confirmation for an active freemium trial', async () => {
    useConfigStore.setState({ stripeEnabled: true, freemiumTrialEnabled: true })
    mockGoalSave(
      async () =>
        new Response(
          JSON.stringify({
            freemium_trial_ends_at: '2099-01-01T00:00:00.000Z',
          })
        )
    )
    renderOnboarding()
    await openGoalsStep()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText(en.onboarding.freemiumTrialTitle)
    ).toBeInTheDocument()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it.each(['non-OK response', 'network rejection'])(
    'shows a recoverable save error after a %s',
    async (failure) => {
      let attempts = 0
      mockGoalSave(async () => {
        attempts += 1
        if (attempts === 1) {
          if (failure === 'non-OK response') {
            return new Response('', { status: 503 })
          }
          throw new Error('offline')
        }
        return new Response(JSON.stringify({ learning_goals: [] }))
      })
      renderOnboarding()
      await openGoalsStep()
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      expect(
        await screen.findByText(/Failed to save preferences/)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled()
      expect(routerPush).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      await vi.waitFor(() =>
        expect(routerPush).toHaveBeenCalledWith('/dashboard')
      )
    }
  )

  it('skips with an empty goals list and saves before navigating', async () => {
    useConfigStore.setState({ stripeEnabled: false })
    mockGoalSave()
    renderOnboarding()
    await openGoalsStep()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    await vi.waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith('/dashboard')
    )
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ target_language: 'es-ES', learning_goals: [] }),
      })
    )
  })

  it.each(Object.keys(catalogs) as Locale[])(
    'names the selected language with natural wording in the %s UI',
    async (locale) => {
      const messages = catalogs[locale]
      renderOnboarding(locale)

      fireEvent.click(
        await screen.findByRole('button', {
          name: new RegExp(messages.targetLanguages['es-ES']),
        })
      )
      fireEvent.click(
        screen.getByRole('button', { name: messages.common.next })
      )

      expect(screen.getByText(spanishSubtitles[locale])).toBeInTheDocument()
    }
  )

  it.each([
    [null, 'English'],
    ['en-GB', 'English'],
    ['en-US', 'English'],
    ['de-DE', 'German'],
    ['fr-FR', 'French'],
    ['it-IT', 'Italian'],
    ['pt-PT', 'Portuguese'],
    ['ja-JP', 'Japanese'],
    ['ko-KR', 'Korean'],
    ['zh-CN', 'Chinese'],
  ])(
    'uses the language-level name for query language=%s',
    async (code, name) => {
      if (code) searchParams.set('language', code)
      renderOnboarding()
      await screen.findByRole('button', { name: /Spanish/ })
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(
        screen.getByText(
          `Language: ${name}. What do you want to use it for? Select all that apply.`
        )
      ).toBeInTheDocument()
    }
  )

  it.each(['', 'unknown-language'])(
    'safely displays the default for language=%s while languages load',
    async (code) => {
      searchParams.set('language', code)
      let resolveLanguages!: (response: Response) => void
      apiFetch.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveLanguages = resolve
        })
      )
      renderOnboarding()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText(englishSubtitle)).toBeInTheDocument()

      await act(async () => resolveLanguages(languageResponse(['fr-FR'])))

      expect(
        screen.getByText(
          'Language: French. What do you want to use it for? Select all that apply.'
        )
      ).toBeInTheDocument()
    }
  )

  it.each(['HTTP', 'network'])(
    'safely displays the default for an invalid query after a %s failure',
    async (failure) => {
      searchParams.set('language', 'unknown-language')
      if (failure === 'HTTP') {
        apiFetch.mockResolvedValueOnce(new Response('', { status: 503 }))
      } else {
        apiFetch.mockRejectedValueOnce(new Error('offline'))
      }
      renderOnboarding()
      await screen.findByText(en.onboarding.saveFailed)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText(englishSubtitle)).toBeInTheDocument()
    }
  )
})
