import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IntersectionObserverMock.instances.push(this)
  }
}

afterEach(() => {
  cleanup()
  IntersectionObserverMock.instances = []
  vi.unstubAllGlobals()
})

describe('scroll reveal', () => {
  it('observes its element, reveals only when intersecting, then unobserves', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const { container, unmount } = render(
      <ScrollReveal className="custom">Revealed content</ScrollReveal>
    )
    const element = container.firstElementChild as HTMLElement
    const observer = IntersectionObserverMock.instances[0]!

    expect(screen.getByText('Revealed content')).toBeInTheDocument()
    expect(element).toHaveClass('reveal', 'custom')
    expect(observer.observe).toHaveBeenCalledWith(element)
    observer.callback(
      [
        {
          isIntersecting: false,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ],
      observer as unknown as IntersectionObserver
    )
    expect(element).not.toHaveClass('reveal-visible')
    observer.callback(
      [
        {
          isIntersecting: true,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ],
      observer as unknown as IntersectionObserver
    )
    expect(element).toHaveClass('reveal-visible')
    expect(observer.unobserve).toHaveBeenCalledWith(element)

    unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
  })

  it('supports omitted className', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const { container } = render(<ScrollReveal>Content</ScrollReveal>)
    expect(container.firstElementChild).toHaveClass('reveal')
    expect(container.firstElementChild).not.toHaveClass('undefined')
  })
})
