import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/flashcards/vocabulary/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/flashcards/vocabulary')({
  validateSearch,
  component: Page,
})
