import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/progress/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/progress')({
  validateSearch,
  component: Page,
})
