import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { detectLocale, readCookie } from './locale'
import { loadCatalog } from '@/i18n/catalogs'
import { loadLanding } from './landing'

export const getRuntime = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const locale = detectLocale(request)
    return {
      locale,
      messages: await loadCatalog(locale),
      hasSession: readCookie(request, 'refresh_token') !== undefined,
      publicApiUrl: process.env.PUBLIC_API_URL || '',
      umamiWebsiteId: process.env.PUBLIC_UMAMI_WEBSITE_ID || '',
    }
  }
)
export const getLanding = createServerFn({ method: 'GET' }).handler(() =>
  loadLanding(getRequest())
)
