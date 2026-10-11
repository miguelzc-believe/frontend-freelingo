export interface TargetLanguage {
  code: string
  name: string
  nameEn: string
  flagPath: string
  iso639: string
  script: TargetLanguageScript
  fontClass: string
  usesWordSpacing: boolean
  romanization?: TargetLanguageRomanization
}

export type TargetLanguageScript =
  'latin' | 'hiragana-katakana-kanji' | 'hangul' | 'simplified-hanzi'

export type TargetLanguageRomanization =
  'romaji' | 'revised-romanization' | 'pinyin'

interface TargetLanguageCapability {
  script: TargetLanguageScript
  fontClass: string
  usesWordSpacing: boolean
  romanization?: TargetLanguageRomanization
}

const LATIN_LANGUAGE_CAPABILITY: TargetLanguageCapability = {
  script: 'latin',
  fontClass: 'font-target-latin',
  usesWordSpacing: true,
}

export const TARGET_LANGUAGE_CAPABILITIES: Record<
  string,
  TargetLanguageCapability
> = {
  'en-US': LATIN_LANGUAGE_CAPABILITY,
  'en-GB': LATIN_LANGUAGE_CAPABILITY,
  'es-ES': LATIN_LANGUAGE_CAPABILITY,
  'it-IT': LATIN_LANGUAGE_CAPABILITY,
  'pt-PT': LATIN_LANGUAGE_CAPABILITY,
  'fr-FR': LATIN_LANGUAGE_CAPABILITY,
  'de-DE': LATIN_LANGUAGE_CAPABILITY,
  'ja-JP': {
    script: 'hiragana-katakana-kanji',
    fontClass: 'font-target-ja',
    usesWordSpacing: false,
    romanization: 'romaji',
  },
  'ko-KR': {
    script: 'hangul',
    fontClass: 'font-target-ko',
    usesWordSpacing: true,
    romanization: 'revised-romanization',
  },
  'zh-CN': {
    script: 'simplified-hanzi',
    fontClass: 'font-target-zh',
    usesWordSpacing: false,
    romanization: 'pinyin',
  },
}

function withCapabilities(
  language: Omit<TargetLanguage, keyof TargetLanguageCapability>
): TargetLanguage {
  return {
    ...language,
    ...(TARGET_LANGUAGE_CAPABILITIES[language.code] ??
      LATIN_LANGUAGE_CAPABILITY),
  }
}

// Keep the authored catalog data separate from its common metadata assembly.
// Tuples retain a fixed schema, ordering and literal display names.
type LanguageCatalogEntry = readonly [
  code: string,
  name: string,
  nameEn: string,
  flagFile: string,
  iso639: string,
]

const LANGUAGE_CATALOG_ENTRIES = [
  ['en-US', 'English (US)', 'English (US)', 'usa.jpg', 'en'],
  ['en-GB', 'English (UK)', 'English (UK)', 'uk.jpg', 'en'],
  ['es-ES', 'Español', 'Spanish', 'spain.jpg', 'es'],
  ['it-IT', 'Italiano', 'Italian', 'italy.jpg', 'it'],
  ['pt-PT', 'Português', 'Portuguese', 'portugal.jpg', 'pt'],
  ['fr-FR', 'Français', 'French', 'france.jpg', 'fr'],
  ['de-DE', 'Deutsch', 'German', 'germany.jpg', 'de'],
  ['ja-JP', '日本語', 'Japanese', 'japan.jpg', 'ja'],
  ['ko-KR', '한국어', 'Korean', 'south_korea.jpg', 'ko'],
  ['zh-CN', '中文（中国）', 'Chinese (Mainland China)', 'china.jpg', 'zh'],
] satisfies readonly LanguageCatalogEntry[]

export const TARGET_LANGUAGE_CATALOG: TargetLanguage[] =
  LANGUAGE_CATALOG_ENTRIES.map(([code, name, nameEn, flagFile, iso639]) =>
    withCapabilities({
      code,
      name,
      nameEn,
      flagPath: `/flags/${flagFile}`,
      iso639,
    })
  )

export const SUPPORTED_TARGET_LANGUAGES: TargetLanguage[] =
  TARGET_LANGUAGE_CATALOG

export function getLanguageByCode(code: string): TargetLanguage | undefined {
  const upper = code.toUpperCase()
  return TARGET_LANGUAGE_CATALOG.find((l) => l.code.toUpperCase() === upper)
}

export function getTargetLanguageCapability(
  code: string
): TargetLanguageCapability {
  return TARGET_LANGUAGE_CAPABILITIES[code] ?? LATIN_LANGUAGE_CAPABILITY
}

export function getTargetLanguageTextClass(code: string): string {
  const capability = getTargetLanguageCapability(code)
  if (capability.script === 'latin') {
    return `${capability.fontClass} text-base leading-relaxed tracking-normal normal-case`
  }
  return `${capability.fontClass} text-base leading-loose tracking-normal normal-case`
}

export const DEFAULT_TARGET_LANGUAGE = 'en-GB'

const LOCALES_CAPITALIZE_LANGUAGE = new Set(['en', 'de', 'nl', 'tr'])

export function formatLanguageName(name: string, locale: string): string {
  const lang = locale.split('-')[0] ?? 'en'
  return LOCALES_CAPITALIZE_LANGUAGE.has(lang) ? name : name.toLowerCase()
}
