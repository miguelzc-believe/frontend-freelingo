import { createFileRoute } from '@tanstack/react-router'
import Home from '@/app/page'
import { getLanding } from '@/server/runtime'
export const Route = createFileRoute('/')({
  loader: () => getLanding(),
  head: () => ({
    meta: [
      { title: 'FreeLingo: AI-powered language learning' },
      { name: 'robots', content: 'index, follow' },
    ],
    links: [{ rel: 'canonical', href: 'https://freelingo.app' }],
  }),
  component: Landing,
})
function Landing() {
  return <Home data={Route.useLoaderData()} />
}
