import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/plan/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/plan')({
  validateSearch,
  component: Page,
})
