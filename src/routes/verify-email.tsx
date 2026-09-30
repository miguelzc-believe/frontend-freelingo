import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/verify-email/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/verify-email')({
  validateSearch,
  component: Page,
})
