import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/vocabulary/[setId]/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/vocabulary/$setId')({
  validateSearch,
  component: Screen,
})
function Screen() {
  return <Page params={Route.useParams()} />
}
