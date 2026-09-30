import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/lesson/[id]/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/lesson/$id')({
  validateSearch,
  component: Page,
})
