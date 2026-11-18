import { cleanup, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ inView: false, reduced: false }))
vi.mock('motion/react', async () => {
  const { createElement } = await import('react')
  return {
    useInView: () => state.inView,
    useReducedMotion: () => state.reduced,
    motion: {
      span: ({
        animate,
        transition,
        initial: _initial,
        ...props
      }: React.ComponentProps<'span'> & {
        animate: { opacity: number; y: string }
        transition: { duration?: number }
        initial: boolean
      }) =>
        createElement('span', {
          ...props,
          'data-opacity': animate.opacity,
          'data-duration': transition.duration,
        }),
    },
  }
})

let InViewTitle: typeof import('@/components/arc/in-view-title/in-view-title').InViewTitle
beforeAll(async () => {
  vi.spyOn(performance, 'now').mockReturnValue(3000)
  ;({ InViewTitle } = await import('@/components/arc/in-view-title/in-view-title'))
})
beforeEach(() => {
  state.inView = false
  state.reduced = false
})
afterEach(cleanup)
afterAll(() => vi.restoreAllMocks())

const hydrateTitle = (once: boolean) => {
  const title = <InViewTitle text="A poster title" variant="line" once={once} />
  const container = document.createElement('div')
  container.innerHTML = renderToString(title)
  document.body.append(container)
  return render(title, { container, hydrate: true })
}

describe('replaying in-view titles', () => {
  it('reveals on each entry even when hydration occurs after the server fallback', () => {
    const view = hydrateTitle(false)
    expect(view.container.querySelector('[data-opacity]')).toHaveAttribute('data-opacity', '0')
    state.inView = true
    view.rerender(<InViewTitle text="A poster title" variant="line" once={false} />)
    expect(view.container.querySelector('[data-opacity]')).toHaveAttribute('data-opacity', '1')
    state.inView = false
    view.rerender(<InViewTitle text="A poster title" variant="line" once={false} />)
    expect(view.container.querySelector('[data-opacity]')).toHaveAttribute('data-opacity', '0')
    vi.spyOn(view.container.firstElementChild!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, -100, 300, 60),
    )
    fireEvent.scroll(window)
    expect(view.container.querySelector('[data-opacity]')).toHaveAttribute('data-opacity', '0')
  })

  it('keeps the late-hydration fallback for titles that only reveal once', () => {
    const view = hydrateTitle(true)
    expect(view.container.querySelector('[data-opacity]')).toHaveAttribute('data-opacity', '1')
  })

  it('keeps replaying titles visible without animation for reduced motion', () => {
    state.reduced = true
    const view = hydrateTitle(false)
    const part = view.container.querySelector('[data-opacity]')
    expect(part).toHaveAttribute('data-opacity', '1')
    expect(part).toHaveAttribute('data-duration', '0')
  })
})
