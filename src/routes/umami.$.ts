import { createFileRoute } from '@tanstack/react-router'
import { proxyAnalytics } from '@/server/analytics'
const handle = ({ request }: { request: Request }) => proxyAnalytics(request)
export const Route = createFileRoute('/umami/$')({
  server: { handlers: { GET: handle, POST: handle } },
})
