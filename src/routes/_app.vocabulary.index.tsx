import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/vocabulary/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/vocabulary/')({
  validateSearch,
  component: Page,
})
