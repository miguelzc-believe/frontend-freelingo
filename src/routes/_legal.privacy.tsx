import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(legal)/privacy/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_legal/privacy')({
  validateSearch,
  component: Page,
})
