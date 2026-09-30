import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/feedback/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/feedback')({
  validateSearch,
  component: Page,
})
