import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/assessment/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/assessment/')({
  validateSearch,
  component: Page,
})
