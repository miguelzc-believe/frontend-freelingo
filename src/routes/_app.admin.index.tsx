import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/admin/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/admin/')({
  validateSearch,
  component: Page,
})
