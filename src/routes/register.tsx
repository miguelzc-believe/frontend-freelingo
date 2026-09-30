import { createFileRoute } from '@tanstack/react-router'
import Page from '@/app/(auth)/register/page'
import { validateSearch } from '@/lib/route-search'
export const Route = createFileRoute('/register')({
  validateSearch,
  component: Page,
})
