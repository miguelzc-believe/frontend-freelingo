import { createFileRoute, Outlet } from '@tanstack/react-router'
import AppLayout from '@/app/(app)/layout'
export const Route = createFileRoute('/_app')({
  ssr: false,
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
})
