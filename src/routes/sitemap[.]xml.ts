import { createFileRoute } from '@tanstack/react-router'
import { sitemapResponse } from '@/server/metadata'
export const Route = createFileRoute('/sitemap.xml')({
  server: { handlers: { GET: sitemapResponse } },
})
