import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LiveRegion } from '../feedback/announce'
import { groupSectionProps } from './group-section'
import { NewRowsFocus } from './show-more'

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const rows = (count: number) => (
  <section {...groupSectionProps('published')}>
    <ol>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <a href={`/admin/collections/articles/${i + 1}`}>Row {i + 1}</a>
        </li>
      ))}
    </ol>
  </section>
)

const watchRegion = () => {
  const region = document.querySelector('[data-portal-live]')!
  const seen: string[] = []
  const observer = new MutationObserver(() => {
    if (region.textContent) seen.push(region.textContent)
  })
  observer.observe(region, { childList: true, characterData: true, subtree: true })
  return seen
}

const page = (
  count: number,
  props: { firstNewIndex: number; focus: 'published' | null; message: string },
) => (
  <>
    <LiveRegion />
    {rows(count)}
    <NewRowsFocus group="published" {...props} />
  </>
)

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('NewRowsFocus', () => {
  it('with focus set, focus moves to the first new row and one announcement says how many', async () => {
    window.history.replaceState(null, '', '/en/spaces/articles?published=2&focus=published')
    const seen = (() => {
      const view = render(<LiveRegion />)
      const watched = watchRegion()
      view.rerender(page(60, { firstNewIndex: 50, focus: 'published', message: '10 more rows.' }))
      return watched
    })()
    await nextFrame()
    expect(document.activeElement?.textContent).toBe('Row 51')
    expect(seen).toEqual(['10 more rows.'])
    expect(window.location.search).toBe('?published=2')
  })

  it('with no focus, a render of page 2 moves no focus', async () => {
    window.history.replaceState(null, '', '/en/spaces/articles?published=2')
    render(page(60, { firstNewIndex: 50, focus: null, message: '10 more rows.' }))
    await nextFrame()
    expect(document.activeElement).toBe(document.body)
    expect(document.querySelector('[data-portal-live]')!.textContent).toBe('')
  })

  it('a rerender for page 3 moves focus again', async () => {
    window.history.replaceState(null, '', '/en/spaces/articles?published=2&focus=published')
    const view = render(<LiveRegion />)
    const seen = watchRegion()
    view.rerender(page(60, { firstNewIndex: 50, focus: 'published', message: '10 more rows.' }))
    await nextFrame()
    window.history.replaceState(null, '', '/en/spaces/articles?published=3&focus=published')
    view.rerender(page(110, { firstNewIndex: 100, focus: 'published', message: '10 more rows.' }))
    await nextFrame()
    expect(document.activeElement?.textContent).toBe('Row 101')
    expect(seen).toEqual(['10 more rows.', '10 more rows.'])
  })

  it('an index past the last row moves no focus', async () => {
    window.history.replaceState(null, '', '/en/spaces/articles?published=2&focus=published')
    render(page(20, { firstNewIndex: 50, focus: 'published', message: '0 more rows.' }))
    await nextFrame()
    expect(document.activeElement).toBe(document.body)
    expect(window.location.search).toBe('?published=2&focus=published')
  })
})
