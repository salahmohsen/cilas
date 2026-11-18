import { cleanup, render, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { InViewTitle } from '@/components/arc/in-view-title/in-view-title'
import { emulateMedia } from '../../../../testing/media.test-utils'

const Page = ({ once }: { once: boolean }) => (
  <div>
    <div style={{ height: 3000 }} />
    <InViewTitle text="A poster title" variant="line" once={once} />
    <div style={{ height: 3000 }} />
  </div>
)

const hydratePage = (once: boolean) => {
  const page = <Page once={once} />
  const container = document.createElement('div')
  container.innerHTML = renderToString(page)
  document.body.append(container)
  return render(page, { container, hydrate: true })
}

const opacityOf = (container: HTMLElement) =>
  getComputedStyle(container.querySelector('h2 [aria-hidden] > span')!).opacity

afterEach(() => {
  cleanup()
  window.scrollTo(0, 0)
})

describe('replaying in-view titles', () => {
  it('reveals on each entry and hides again when the title leaves', async () => {
    const { container } = hydratePage(false)
    expect(opacityOf(container)).toBe('0')
    container.querySelector('h2')!.scrollIntoView({ block: 'center' })
    await waitFor(() => expect(opacityOf(container)).toBe('1'))
    window.scrollTo(0, 0)
    await waitFor(() => expect(opacityOf(container)).toBe('0'))
  })

  it('keeps a replaying title hidden after it scrolled past the top', async () => {
    const { container } = hydratePage(false)
    window.scrollTo(0, 6000)
    await waitFor(() =>
      expect(container.querySelector('h2')!.getBoundingClientRect().top).toBeLessThan(0),
    )
    expect(opacityOf(container)).toBe('0')
  })

  it('shows a title that only reveals once when the reader scrolls past it', async () => {
    const { container } = hydratePage(true)
    expect(opacityOf(container)).toBe('0')
    window.scrollTo(0, 6000)
    await waitFor(() => expect(opacityOf(container)).toBe('1'))
  })

  it('keeps replaying titles visible without animation for reduced motion', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'reduce' })
    const { container } = hydratePage(false)
    expect(opacityOf(container)).toBe('1')
  })
})
