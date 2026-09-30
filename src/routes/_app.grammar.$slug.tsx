import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/grammar/[slug]/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/grammar/$slug')({
  validateSearch,
  component: Screen,
})
function Screen() {
  return <Page params={Route.useParams()} />
}
