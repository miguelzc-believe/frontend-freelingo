import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/assessment/level-test/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/assessment/level-test')({
  validateSearch,
  component: Page,
})
