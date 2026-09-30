import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/conversation/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/conversation')({
  validateSearch,
  component: Page,
})
