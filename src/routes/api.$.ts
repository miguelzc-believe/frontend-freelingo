import { createFileRoute } from '@tanstack/react-router'
import { proxyBackend } from '@/server/proxy'
const handle = ({ request }: { request: Request }) => proxyBackend(request)
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
      HEAD: handle,
    },
  },
})
