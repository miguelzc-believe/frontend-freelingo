import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/admin/feedback/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/admin/feedback')({
  validateSearch,
  component: Page,
})
