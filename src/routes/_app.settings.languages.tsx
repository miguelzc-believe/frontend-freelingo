import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/settings/languages/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/settings/languages')({
  validateSearch,
  component: Page,
})
