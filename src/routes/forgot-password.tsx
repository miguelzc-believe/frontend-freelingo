import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/forgot-password/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/forgot-password')({
  validateSearch,
  component: Page,
})
