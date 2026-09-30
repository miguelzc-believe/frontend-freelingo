import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/admin/users/[id]/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/admin/users/$id')({
  validateSearch,
  component: Page,
})
