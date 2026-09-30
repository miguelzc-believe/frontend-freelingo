import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/billing/canceled/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/billing/canceled')({
  ssr: false,
  validateSearch,
  component: Page,
})
