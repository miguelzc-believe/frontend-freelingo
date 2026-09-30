import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/settings/memories/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/settings/memories')({
  validateSearch,
  component: Page,
})
