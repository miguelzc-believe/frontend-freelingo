import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/onboarding/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/onboarding')({
  ssr: false,
  validateSearch,
  component: Page,
})
