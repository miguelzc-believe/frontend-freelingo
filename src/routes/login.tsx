import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/login/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/login')({
  validateSearch,
  component: Page,
})
