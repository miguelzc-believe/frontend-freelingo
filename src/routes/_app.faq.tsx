import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/faq/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/faq')({
  validateSearch,
  component: Page,
})
