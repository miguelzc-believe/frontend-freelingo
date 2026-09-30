import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/listening/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/listening')({
  validateSearch,
  component: Page,
})
