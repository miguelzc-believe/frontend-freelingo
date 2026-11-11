import { describe, expect, it } from 'vitest'
import { loadCatalog } from '@/i18n/catalogs'
import type { Locale } from '@/lib/locales'
import english from '../../messages/en.json'
import spanish from '../../messages/es.json'

describe('message catalog loading', () => {
  it('loads the requested locale instead of always using English', async () => {
    expect(await loadCatalog('es')).toEqual(spanish)
    expect(await loadCatalog('en')).toEqual(english)
  })

  it('falls back to English for an unavailable locale', async () => {
    expect(await loadCatalog('not-a-locale' as Locale)).toEqual(english)
  })
})
