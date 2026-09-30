import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(legal)/terms/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_legal/terms')({
  validateSearch,
  component: Page,
})
