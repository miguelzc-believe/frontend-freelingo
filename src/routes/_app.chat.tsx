import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(app)/chat/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/_app/chat')({
  validateSearch,
  component: Page,
})
