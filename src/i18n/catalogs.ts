import type { Locale } from '@/lib/locales'
import english from '../../messages/en.json'

const catalogs = import.meta.glob<typeof english>('../../messages/*.json', {
  import: 'default',
})
export async function loadCatalog(locale: Locale): Promise<typeof english> {
  return (
    (await catalogs[`../../messages/${locale}.json`]?.().catch(
      () => english
    )) ?? english
  )
}
