import { createFileRoute } from '@tanstack/react-router'
import { manifestResponse } from '@/server/metadata'
export const Route = createFileRoute('/manifest.webmanifest')({
  server: { handlers: { GET: manifestResponse } },
})
