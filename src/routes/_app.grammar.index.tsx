import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/grammar/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/grammar/')({
  validateSearch,
  component: Page,
})
