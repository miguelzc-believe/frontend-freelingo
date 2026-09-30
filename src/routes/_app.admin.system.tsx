import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/admin/system/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/admin/system')({
  validateSearch,
  component: Page,
})
