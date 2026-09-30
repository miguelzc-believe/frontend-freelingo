import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/billing/success/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/billing/success')({
  ssr: false,
  validateSearch,
  component: Page,
})
