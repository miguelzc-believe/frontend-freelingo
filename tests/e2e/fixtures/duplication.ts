import type { Page, Route } from '@playwright/test'
import type { GrammarNativeHelp, GrammarTopic } from '../../../src/data/grammar'
import type {
  PhrasebookCategory,
  PhrasebookNativeHelp,
} from '../../../src/data/phrasebook'
import type {
  VocabularyNativeHelp,
  VocabularySet,
} from '../../../src/data/types'
import type { ListeningExercise, ReadingExercise } from '../../../src/types/api'

type HttpHandler = (route: Route, url: URL) => Promise<void>

const mockBackendRoutes = new Set([
  'GET /api/config',
  'POST /api/auth/refresh',
  'GET /api/auth/me',
  'GET /api/languages',
  'GET /api/feedback/unread-summary',
  'GET /api/feedback/unread-count',
  'GET /api/reviews/public',
])

export async function browserFixture(page: Page) {
  const handlers = new Map<string, HttpHandler>()
  const unexpected: string[] = []
  const runtimeErrors: string[] = []
  const expectedHttpErrors = new Set<string>()

  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return
    // A deliberate native-help 503 is a recoverable HTTP error, not a JS error.
    const location = message.location().url
    if (
      message.type() === 'error' &&
      message.text().includes('Failed to load resource') &&
      message.text().includes('503') &&
      location &&
      expectedHttpErrors.has(new URL(location).pathname)
    ) {
      return
    }
    runtimeErrors.push(`${message.type()}: ${message.text()}`)
  })

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    // Only the production test server and its deterministic mock backend are used.
    if (url.origin !== 'http://127.0.0.1:3102') {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`)
      await route.abort('blockedbyclient')
      return
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }
    const key = `${request.method()} ${url.pathname}`
    const handler = handlers.get(key)
    if (handler) {
      await handler(route, url)
      return
    }
    if (mockBackendRoutes.has(key)) {
      // Existing scripts/mock-backend.ts owns user 1 (es / en-GB), the
      // httpOnly browser-fixture session, registration config and languages.
      await route.continue()
      return
    }
    unexpected.push(key)
    await route.abort('blockedbyclient')
  })

  for (const kind of ['llm', 'tts', 'stt']) {
    handlers.set(`GET /api/${kind}-settings/status`, async (route) => {
      await route.fulfill({
        json: {
          configured: true,
          provider: 'local',
          model: 'synthetic-fixture',
        },
      })
    })
  }

  return {
    unexpected,
    runtimeErrors,
    handle: (method: string, path: string, handler: HttpHandler) => {
      handlers.set(`${method} ${path}`, handler)
    },
    json: (method: string, path: string, json: unknown) => {
      handlers.set(`${method} ${path}`, async (route) => {
        await route.fulfill({ json })
      })
    },
    allowHttpError: (path: string) => expectedHttpErrors.add(path),
  }
}

export type BrowserFixture = Awaited<ReturnType<typeof browserFixture>>

const questions = [
  {
    index: 0,
    question: 'Where does Maya go?',
    options: { A: 'To the library', B: 'To the station' },
  },
  {
    index: 1,
    question: 'What does Maya borrow?',
    options: { A: 'A cookbook', B: 'A travel guide' },
  },
]

export const passage = 'Maya goes to the library and borrows a travel guide.'
export const transcript =
  'SYNTHETIC TRANSCRIPT: Maya visits the library to borrow a travel guide.'

export const readingExercise = {
  id: 701,
  level: 'A1',
  target_language: 'en-GB',
  exercise_type: 'multiple_choice',
  topic: 'Fixture library visit',
  text: passage,
  questions,
} satisfies ReadingExercise

export const listeningExercise = {
  id: 702,
  level: 'A1',
  target_language: 'en-GB',
  exercise_type: 'multiple_choice',
  topic: 'Fixture library recording',
  duration_seconds: 8,
  questions,
} satisfies ListeningExercise

export function practiceFixture(
  fixture: BrowserFixture,
  modality: 'reading' | 'listening'
) {
  const exercise = modality === 'reading' ? readingExercise : listeningExercise
  const attempts: unknown[] = []
  const historyQueries: string[] = []
  const correctAnswers = [
    { index: 0, correct: 'A' },
    { index: 1, correct: 'B' },
  ]

  fixture.json('GET', `/api/${modality}/next`, { available: true, exercise })
  fixture.handle('POST', `/api/${modality}/attempt`, async (route) => {
    const body: unknown = route.request().postDataJSON()
    attempts.push(body)
    await route.fulfill({
      json: {
        score: attempts.length === 1 ? 1 : 2,
        xp_earned: attempts.length === 1 ? 12 : 0,
        correct_answers: correctAnswers,
        ...(modality === 'listening' ? { text: transcript } : {}),
      },
    })
  })
  fixture.handle('GET', `/api/${modality}/history`, async (route, url) => {
    historyQueries.push(url.search)
    await route.fulfill({
      json: {
        items: [
          {
            id: 801,
            score: 1,
            xp_earned: 12,
            completed_at: '2026-01-01T12:00:00Z',
            exercise,
            answers: { '0': 'A', '1': 'A' },
            ...(modality === 'listening'
              ? { text: transcript }
              : { correct_answers: correctAnswers }),
          },
        ],
        total: 1,
      },
    })
  })
  return { attempts, historyQueries, exercise }
}

const grammarTopic = {
  slug: 'fixture-present',
  title: 'Fixture present tense',
  level: 'A1',
  category: 'Tenses',
  summary: 'Describe routines in the present.',
  explanation: 'Use the present for a routine.',
  rules: ['Use a subject before the verb.'],
  examples: [{ text: 'I visit the library.', note: 'A regular routine.' }],
  common_mistakes: [],
  related: [],
} satisfies GrammarTopic

const vocabularySet = {
  id: 'fixture-library',
  level: 'B1',
  topic: 'Library words',
  unit_ref: 'fixture-unit',
  words: [
    {
      word: 'borrow',
      pos: 'verb',
      definition: 'Take something and return it later.',
      example: 'I borrow a book from the library.',
    },
  ],
} satisfies VocabularySet

const phrasebookCategory = {
  id: 'fixture-request',
  level: 'A1',
  situation: 'Fixture polite requests',
  icon: '●',
  phrases: [
    {
      text: 'Could I borrow this book?',
      context: 'Ask a librarian politely.',
      register: 'formal',
    },
  ],
} satisfies PhrasebookCategory

// Duplicate authored entries deliberately exercise occurrence keys in shared
// lists, traps and glossary helpers without React duplicate-key warnings.
const trap = {
  mistake: 'No confundas pedir prestado con prestar.',
  fix: 'Usa borrow cuando recibes algo temporalmente.',
}
const glossary = { term: 'borrow', meaning: 'pedir prestado', note: 'Verbo.' }
const repeatedTip = 'Practica con una frase corta.'

const grammarHelp = {
  summary: 'Ayuda de gramática para rutinas.',
  explanation: 'El presente describe una rutina habitual.',
  key_points: [repeatedTip, repeatedTip],
  examples: [{ sentence: 'I read every day.', note: 'Una rutina diaria.' }],
  common_traps: [trap, trap],
  mini_glossary: [glossary, glossary],
} satisfies GrammarNativeHelp

const vocabularyHelp = {
  summary: 'Ayuda de vocabulario de la biblioteca.',
  study_tips: [repeatedTip, repeatedTip],
  word_notes: [
    { word: 'borrow', meaning: 'pedir prestado', note: 'Devuelve el libro.' },
  ],
  common_traps: [trap, trap],
  mini_glossary: [glossary, glossary],
  practice_prompts: ['Describe el libro que quieres.'],
} satisfies VocabularyNativeHelp

const phrasebookHelp = {
  summary: 'Ayuda para pedir un libro con cortesía.',
  usage_tips: [repeatedTip, repeatedTip],
  register_notes: ['Esta petición es formal.'],
  phrase_notes: [
    { phrase: 'Could I borrow this book?', note: 'Una petición educada.' },
  ],
  common_traps: [trap, trap],
  mini_glossary: [glossary, glossary],
} satisfies PhrasebookNativeHelp

export const nativeScenarios = [
  {
    kind: 'grammar',
    path: `/grammar/${grammarTopic.slug}`,
    api: `/api/grammar/${grammarTopic.slug}/native-help`,
    summary: grammarHelp.summary,
    target: 'I read every day.',
    autoLoad: true,
    initiallyOpen: true,
    failsFirst: false,
  },
  {
    kind: 'vocabulary',
    path: `/vocabulary/${vocabularySet.id}`,
    api: `/api/vocabulary/${vocabularySet.id}/native-help`,
    summary: vocabularyHelp.summary,
    target: 'Take something and return it later.',
    autoLoad: false,
    initiallyOpen: false,
    failsFirst: true,
  },
  {
    kind: 'phrasebook',
    path: '/phrasebook',
    api: `/api/phrasebook/${phrasebookCategory.id}/native-help`,
    summary: phrasebookHelp.summary,
    target: 'Could I borrow this book?',
    autoLoad: false,
    initiallyOpen: true,
    failsFirst: false,
  },
] as const

function responseGate() {
  let release: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    waiting,
    release: () => release?.(),
  }
}

export function nativeFixture(fixture: BrowserFixture) {
  fixture.json('GET', '/api/grammar', { topics: [grammarTopic] })
  fixture.json('GET', `/api/vocabulary/${vocabularySet.id}`, {
    set: vocabularySet,
  })
  fixture.json('GET', '/api/phrasebook', { categories: [phrasebookCategory] })

  const help = {
    grammar: grammarHelp,
    vocabulary: vocabularyHelp,
    phrasebook: phrasebookHelp,
  }
  return nativeScenarios.map((scenario) => {
    const gate = responseGate()
    const languages: Array<string | null> = []
    if (scenario.failsFirst) fixture.allowHttpError(scenario.api)
    fixture.handle('POST', scenario.api, async (route, url) => {
      languages.push(url.searchParams.get('language'))
      if (scenario.failsFirst && languages.length === 1) {
        await route.fulfill({ status: 503, json: { detail: 'fixture_retry' } })
        return
      }
      await gate.waiting
      await route.fulfill({ json: { native_help: help[scenario.kind] } })
    })
    return { ...scenario, languages, release: gate.release }
  })
}

export const nativeAssertions = {
  repeatedTip,
  trap,
  glossary,
}

export const nativeLanguageCodes = [
  'en',
  'es',
  'fr',
  'pt',
  'de',
  'it',
  'pl',
  'nl',
  'ro',
  'ru',
  'tr',
  'sv',
  'da',
  'fi',
  'hr',
]

export const adminUser = {
  id: 41,
  username: 'fixture_library',
  display_name: 'Fixture Library Learner',
  email: 'fixture-library@example.invalid',
  role: 'user',
  native_language: 'es',
  is_active: true,
  is_verified: true,
  subscription_status: 'paused',
  subscription_ends_at: null,
  stripe_customer_id: null,
  conversation_weekly_sessions: 5,
  conversation_daily_minutes: 10,
  conversation_weekly_minutes: 30,
  monthly_tokens_limit: 1000,
}

export function adminFixture(fixture: BrowserFixture) {
  fixture.json('GET', '/api/config', {
    allow_registration: true,
    stripe_enabled: true,
    maintenance_mode: false,
  })
  fixture.json('GET', '/api/admin/users', {
    items: [adminUser],
    total: 1,
    skip: 0,
    limit: 10,
  })
  fixture.json('GET', `/api/admin/users/${adminUser.id}`, adminUser)
  fixture.json('GET', `/api/admin/users/${adminUser.id}/stats`, {
    user_id: adminUser.id,
    current_cefr: 'A1',
    current_unit: null,
    plan_duration_weeks: null,
    completion_test_score: null,
    xp_total: 50,
    streak_current: 2,
    active_days: 3,
    lessons_completed: 4,
    exercises_correct: 1,
    exercises_total: 2,
    chat_messages_sent: 0,
    tokens_total: 0,
    tokens_chat: 0,
    tokens_conversation: 0,
    per_language: [],
  })
  fixture.json('GET', `/api/admin/users/${adminUser.id}/quota`, {
    sessions_this_week: 0,
    sessions_limit: 5,
    sessions_unlimited: false,
    minutes_today: 0,
    minutes_limit: 10,
    time_unlimited: false,
    minutes_this_week: 0,
    weekly_minutes_limit: 30,
    weekly_minutes_unlimited: false,
  })
}
