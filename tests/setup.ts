import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi, afterEach } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorageMock.clear()
})

vi.mock('@/lib/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/app-image', () => ({
  default: function MockImage(
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      unoptimized?: boolean
      priority?: boolean
    }
  ) {
    const { unoptimized, priority, ...imgProps } = props
    void unoptimized
    void priority
    return React.createElement('img', imgProps)
  },
}))

vi.mock('@/components/ui/app-link', () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', props),
}))
