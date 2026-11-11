import type { ComponentType } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLanding: vi.fn(),
  data: { hasSession: true },
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => mocks.data,
  }),
}))
vi.mock('@/server/runtime', () => ({ getLanding: mocks.getLanding }))
vi.mock('@/app/page', () => ({
  default: ({ data }: { data: typeof mocks.data }) => (
    <p>{data.hasSession ? 'signed in' : 'guest'}</p>
  ),
}))

import { Route } from '@/routes/index'

describe('landing route', () => {
  it('loads landing data and renders it with canonical metadata', () => {
    const options = Route.options as unknown as {
      loader: () => unknown
      head: () => { links: unknown[]; meta: unknown[] }
      component: ComponentType
    }
    mocks.getLanding.mockReturnValueOnce(mocks.data)
    expect(options.loader()).toEqual(mocks.data)
    expect(options.head().links).toContainEqual({
      rel: 'canonical',
      href: 'https://freelingo.app',
    })
    expect(options.head().meta).toContainEqual({
      name: 'robots',
      content: 'index, follow',
    })
    const Landing = options.component
    render(<Landing />)
    expect(screen.getByText('signed in')).toBeInTheDocument()
  })
})
