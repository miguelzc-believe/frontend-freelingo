import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/reset-password/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/reset-password')({
  validateSearch,
  component: Page,
})
