import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/admin/reviews/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/admin/reviews')({
  validateSearch,
  component: Page,
})
