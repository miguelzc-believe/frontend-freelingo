import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/dashboard/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/dashboard')({
  validateSearch,
  component: Page,
})
