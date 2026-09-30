import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/phrasebook/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/phrasebook')({
  validateSearch,
  component: Page,
})
