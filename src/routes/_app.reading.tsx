import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/reading/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/reading')({
  validateSearch,
  component: Page,
})
