import { SUPPORTED_LOCALES, type Locale } from '@/lib/locales'

export function readCookie(request: Request, name: string): string | undefined {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
  if (value === undefined) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

export function detectLocale(request: Request): Locale {
  const cookie = readCookie(request, 'NEXT_LOCALE')
  if (SUPPORTED_LOCALES.some((locale) => locale === cookie))
    return cookie as Locale
  const languages = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...options] = part.trim().split(';')
      const quality = options.find((option) => option.trim().startsWith('q='))
      return {
        language: tag.split(/[-_]/)[0]?.toLowerCase(),
        q: quality ? Number(quality.trim().slice(2)) : 1,
      }
    })
    .filter(({ q }) => q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q)
  for (const { language } of languages) {
    if (SUPPORTED_LOCALES.some((locale) => locale === language))
      return language as Locale
  }
  return 'en'
}
