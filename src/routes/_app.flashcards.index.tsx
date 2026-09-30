import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/flashcards/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/flashcards/')({
  validateSearch,
  component: Page,
})
